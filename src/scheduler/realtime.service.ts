import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { chromium } from 'playwright';
import WebSocket from 'ws';
import { TextChannel } from 'discord.js';
import { SessionService, STATE_FILE } from '../wanted/session.service';
import { BotService } from '../bot/bot.service';

@Injectable()
export class RealtimeService implements OnModuleInit, OnModuleDestroy {
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private destroyed = false;
  private stompPasscode = '';
  private stompDestination = '';

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
    const params = await this.captureStompParams();
    if (!params) {
      console.log('[realtime] STOMP 파라미터 캡처 실패 — 5분 후 재시도');
      this.reconnectTimer = setTimeout(() => this.start(), 5 * 60 * 1000);
      return;
    }
    this.stompPasscode = params.passcode;
    this.stompDestination = params.destination;
    this.connectWs();
  }

  private async captureStompParams(): Promise<{ passcode: string; destination: string } | null> {
    console.log('[realtime] Playwright로 STOMP 파라미터 캡처 중...');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ storageState: STATE_FILE });
    const page = await context.newPage();

    try {
      return await new Promise<{ passcode: string; destination: string } | null>((resolve) => {
        let passcode = '';
        let resolved = false;

        const done = (val: { passcode: string; destination: string } | null) => {
          if (!resolved) { resolved = true; resolve(val); }
        };

        page.on('websocket', (wsEvent) => {
          wsEvent.on('framesent', (frame) => {
            const data = typeof frame.payload === 'string'
              ? frame.payload
              : Buffer.from(frame.payload as Buffer).toString();

            if (data.startsWith('CONNECT')) {
              const m = data.match(/passcode:([^\r\n\0]+)/);
              if (m) passcode = m[1].trim();
              console.log('[realtime] CONNECT 캡처 완료');
            }
            if (data.startsWith('SUBSCRIBE') && passcode) {
              const m = data.match(/destination:([^\r\n\0]+)/);
              if (m) {
                console.log('[realtime] SUBSCRIBE 캡처 완료:', m[1].trim());
                done({ passcode, destination: m[1].trim() });
              }
            }
          });
        });

        page.goto('https://www.wanted.co.kr/', { waitUntil: 'domcontentloaded', timeout: 15_000 })
          .catch(() => {});

        setTimeout(() => done(null), 20_000);
      });
    } finally {
      await page.close().catch(() => {});
      await browser.close().catch(() => {});
    }
  }

  private connectWs() {
    if (this.destroyed) return;
    console.log('[realtime] WebSocket 연결 중...');

    this.ws = new WebSocket('wss://rtws.wanted.co.kr/ws', {
      headers: {
        'Origin': 'https://www.wanted.co.kr',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      },
    });

    this.ws.on('open', () => {
      console.log('[realtime] WebSocket 열림, STOMP CONNECT 전송');
      const frame = `CONNECT\naccept-version:1.1,1.2\nlogin:client\npasscode:${this.stompPasscode}\nhost:/wpoint\nheart-beat:10000,10000\n\n\0`;
      this.ws!.send(frame);
    });

    this.ws.on('message', async (raw) => {
      const data = raw.toString();
      if (data.startsWith('CONNECTED')) {
        console.log(`[realtime] STOMP 연결됨, 구독 시작: ${this.stompDestination}`);
        const subFrame = `SUBSCRIBE\nid:sub-0\ndestination:${this.stompDestination}\nack:auto\n\n\0`;
        this.ws!.send(subFrame);

        // heartbeat: 10초마다 \n 전송
        this.heartbeatTimer = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) this.ws.send('\n');
        }, 10_000);
      } else if (data.startsWith('MESSAGE')) {
        await this.handleStompMessage(data);
      } else if (data.startsWith('ERROR')) {
        console.error('[realtime] STOMP ERROR:', data.substring(0, 300));
      }
    });

    this.ws.on('error', (err) => {
      console.error('[realtime] WebSocket 오류:', err.message);
    });

    this.ws.on('close', (code) => {
      console.log(`[realtime] WebSocket 닫힘 (${code}) — 30초 후 재연결`);
      this.clearTimers();
      if (!this.destroyed) {
        this.reconnectTimer = setTimeout(() => this.connectWs(), 30_000);
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
