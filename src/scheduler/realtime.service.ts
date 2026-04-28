import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { chromium } from 'playwright';
import WebSocket from 'ws';
import { TextChannel } from 'discord.js';
import path from 'path';
import fs from 'fs';
import { SessionService, STATE_FILE, SESSION_DIR } from '../wanted/session.service';
import { BotService } from '../bot/bot.service';

const STOMP_PARAMS_FILE = path.join(SESSION_DIR, 'stomp-params.json');

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

  async start() {
    this.stompParams = this.loadCachedParams() ?? await this.captureStompParams();

    if (!this.stompParams) {
      console.log('[realtime] STOMP 파라미터 획득 실패 — 5분 후 재시도');
      this.reconnectTimer = setTimeout(() => this.start(), 5 * 60 * 1000);
      return;
    }

    this.connectWs();
  }

  private loadCachedParams(): StompParams | null {
    try {
      if (!fs.existsSync(STOMP_PARAMS_FILE)) return null;
      const data = JSON.parse(fs.readFileSync(STOMP_PARAMS_FILE, 'utf-8'));
      if (data?.passcode && data?.destination) {
        console.log('[realtime] 캐시에서 STOMP 파라미터 로드');
        return data as StompParams;
      }
    } catch {}
    return null;
  }

  private saveCachedParams(params: StompParams) {
    try {
      fs.writeFileSync(STOMP_PARAMS_FILE, JSON.stringify(params, null, 2));
    } catch (err) {
      console.error('[realtime] STOMP 파라미터 캐시 저장 실패:', err);
    }
  }

  private async captureStompParams(): Promise<StompParams | null> {
    console.log('[realtime] Playwright로 STOMP 파라미터 캡처 중...');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ storageState: STATE_FILE });
    const page = await context.newPage();

    try {
      const params = await new Promise<StompParams | null>((resolve) => {
        let passcode = '';
        let resolved = false;

        const done = (val: StompParams | null) => {
          if (!resolved) { resolved = true; resolve(val); }
        };

        page.on('websocket', (wsEvent) => {
          wsEvent.on('framesent', (frame) => {
            const data = typeof frame.payload === 'string'
              ? frame.payload
              : Buffer.from(frame.payload as Buffer).toString();

            if (data.startsWith('CONNECT')) {
              const m = data.match(/passcode:([^\r\n\0]+)/);
              if (m) { passcode = m[1].trim(); console.log('[realtime] CONNECT 캡처'); }
            }
            if (data.startsWith('SUBSCRIBE') && passcode) {
              const m = data.match(/destination:([^\r\n\0]+)/);
              if (m) {
                console.log('[realtime] SUBSCRIBE 캡처:', m[1].trim());
                done({ passcode, destination: m[1].trim() });
              }
            }
          });
        });

        page.goto('https://www.wanted.co.kr/', { waitUntil: 'domcontentloaded', timeout: 15_000 }).catch(() => {});
        setTimeout(() => done(null), 20_000);
      });

      if (params) this.saveCachedParams(params);
      return params;
    } finally {
      await page.close().catch(() => {});
      await browser.close().catch(() => {});
    }
  }

  private connectWs() {
    if (this.destroyed || !this.stompParams) return;
    console.log('[realtime] WebSocket 연결 중...');

    this.ws = new WebSocket('wss://rtws.wanted.co.kr/ws', {
      headers: {
        Origin: 'https://www.wanted.co.kr',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
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
        // 인증 에러면 캐시 삭제 후 재캡처
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
