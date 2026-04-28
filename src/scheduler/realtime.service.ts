import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import WebSocket from 'ws';
import { TextChannel } from 'discord.js';
import path from 'path';
import fs from 'fs';
import { SessionService, STATE_FILE, SESSION_DIR } from '../wanted/session.service';
import { BotService } from '../bot/bot.service';

const STOMP_PARAMS_FILE = path.join(SESSION_DIR, 'stomp-params.json');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

interface StompParams {
  passcode: string;
  destination: string;
}

@Injectable()
export class RealtimeService implements OnModuleInit, OnModuleDestroy {
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private destroyed = false;
  private stompParams: StompParams | null = null;

  constructor(
    private readonly session: SessionService,
    private readonly bot: BotService,
  ) {}

  async onModuleInit() {
    if (!this.session.sessionExists()) {
      console.log('[realtime] 세션 없음 — 실시간 알림 비활성화');
      return;
    }
    await this.start();
  }

  onModuleDestroy() {
    this.destroyed = true;
    this.clearTimers();
    this.ws?.close();
  }

  private clearTimers() {
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; }
  }

  private cookieHeader(): string {
    const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    return (state.cookies as any[])
      .filter((c) => c.domain.endsWith('wanted.co.kr'))
      .map((c) => `${c.name}=${c.value}`)
      .join('; ');
  }

  private loadCachedPasscode(): string | null {
    try {
      if (!fs.existsSync(STOMP_PARAMS_FILE)) return null;
      const data = JSON.parse(fs.readFileSync(STOMP_PARAMS_FILE, 'utf-8'));
      return data?.passcode ?? null;
    } catch { return null; }
  }

  async start() {
    const params = await this.resolveStompParams();
    if (!params) {
      console.log('[realtime] STOMP 파라미터 획득 실패 — 5분 후 재시도');
      this.reconnectTimer = setTimeout(() => this.start(), 5 * 60 * 1000);
      return;
    }
    this.stompParams = params;
    this.connectWs();
  }

  private async resolveStompParams(): Promise<StompParams | null> {
    try {
      // destination: /api/v1/me 에서 user_hash로 실시간 조회
      const res = await fetch('https://www.wanted.co.kr/api/v1/me', {
        headers: {
          Cookie: this.cookieHeader(),
          'User-Agent': UA,
          Accept: 'application/json',
          Referer: 'https://www.wanted.co.kr/',
        },
      });
      if (!res.ok) {
        console.warn('[realtime] /api/v1/me 실패:', res.status);
        return null;
      }
      const me = await res.json();
      const userHash: string = me?.user_hash;
      if (!userHash) {
        console.warn('[realtime] user_hash 없음');
        return null;
      }
      const destination = `/topic/wpoint.${userHash}`;

      // passcode: 캐시 파일에서 로드
      const passcode = this.loadCachedPasscode();
      if (!passcode) {
        console.warn('[realtime] stomp-params.json에 passcode 없음 — npm run wanted:login 재실행 필요');
        return null;
      }

      console.log(`[realtime] STOMP 파라미터 준비 완료 → ${destination}`);
      return { passcode, destination };
    } catch (err) {
      console.error('[realtime] resolveStompParams 실패:', err);
      return null;
    }
  }

  private connectWs() {
    if (this.destroyed || !this.stompParams) return;
    console.log('[realtime] WebSocket 연결 중...');

    this.ws = new WebSocket('wss://rtws.wanted.co.kr/ws', {
      headers: {
        Origin: 'https://www.wanted.co.kr',
        'User-Agent': UA,
      },
    });

    this.ws.on('open', () => {
      const { passcode } = this.stompParams!;
      const frame = `CONNECT\naccept-version:1.1,1.2\nlogin:client\npasscode:${passcode}\nhost:/wpoint\nheart-beat:10000,10000\n\n\0`;
      this.ws!.send(frame);
    });

    this.ws.on('message', async (raw) => {
      const data = raw.toString();
      if (data.startsWith('CONNECTED')) {
        console.log(`[realtime] STOMP 연결됨 → ${this.stompParams!.destination}`);
        const subFrame = `SUBSCRIBE\nid:sub-0\ndestination:${this.stompParams!.destination}\nack:auto\n\n\0`;
        this.ws!.send(subFrame);
        this.heartbeatTimer = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) this.ws.send('\n');
        }, 10_000);
      } else if (data.startsWith('MESSAGE')) {
        await this.handleStompMessage(data);
      } else if (data.startsWith('ERROR')) {
        console.error('[realtime] STOMP ERROR:', data.substring(0, 300));
        if (data.includes('access refused') || data.includes('Not authorized')) {
          fs.rmSync(STOMP_PARAMS_FILE, { force: true });
          this.stompParams = null;
        }
      }
    });

    this.ws.on('error', (err) => {
      console.error('[realtime] WebSocket 오류:', err.message);
    });

    this.ws.on('close', (code) => {
      console.log(`[realtime] WebSocket 닫힘 (${code}) — 30초 후 재연결`);
      this.clearTimers();
      if (!this.destroyed) {
        this.reconnectTimer = setTimeout(() => {
          if (this.stompParams) this.connectWs();
          else this.start();
        }, 30_000);
      }
    });
  }

  private async handleStompMessage(raw: string) {
    try {
      const bodyStart = raw.indexOf('\n\n');
      if (bodyStart === -1) return;
      const bodyRaw = raw.substring(bodyStart + 2).replace(/\0$/, '').trim();
      const body = JSON.parse(bodyRaw);
      console.log('[realtime] 메시지:', JSON.stringify(body).substring(0, 300));

      if (body?.push_type && body.push_type !== 'application') return;
      const text: string = body?.text ?? body?.message ?? body?.body ?? '';
      if (!text) return;
      if (text.includes('이력서를 제출')) return;

      await this.sendToChannel(`🔔 ${text}`);
    } catch (err) {
      console.error('[realtime] 메시지 파싱 오류:', err);
    }
  }

  private async sendToChannel(content: string) {
    const channelId = process.env.ALERT_CHANNEL_ID;
    const ownerId = process.env.OWNER_DISCORD_ID;
    if (!channelId || !ownerId) return;
    try {
      const channel = await this.bot.client.channels.fetch(channelId);
      if (!channel || !(channel instanceof TextChannel)) return;
      await channel.send({ content: `<@${ownerId}> ${content}` });
    } catch (err) {
      console.error('[realtime] Discord 전송 실패:', err);
    }
  }
}
