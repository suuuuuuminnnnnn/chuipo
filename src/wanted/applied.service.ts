import { Injectable } from '@nestjs/common';
import { SessionService } from './session.service';

export interface ApplicationStatus {
  wanted_job_id: number;
  company_name: string;
  position: string;
  status: string;
  applied_at?: string;
}

export interface WantedNotification {
  text: string;
  time: string;
  push_value: string;
}

const STATUS_SLUGS = ['complete', 'pass', 'hire', 'reject'];

@Injectable()
export class AppliedService {
  constructor(private readonly session: SessionService) {}

  async fetchApplications(): Promise<ApplicationStatus[]> {
    return this.session.withSession(async (context) => {
      const page = await context.newPage();
      try {
        // 첫 페이지 로드로 user_id 확보
        const responsePromise = page.waitForResponse(
          (res) => res.url().includes('/api/v1/applications') && res.status() === 200,
          { timeout: 20_000 },
        );
        await page.goto('https://www.wanted.co.kr/status/applications/applied', {
          waitUntil: 'domcontentloaded',
          timeout: 15_000,
        });
        const firstRes = await responsePromise;
        const userId = new URL(firstRes.url()).searchParams.get('user_id');
        if (!userId) {
          console.error('[applied] user_id 추출 실패');
          return [];
        }

        // 각 상태별로 page.evaluate fetch (인증 쿠키 자동 포함)
        const all: ApplicationStatus[] = [];
        for (const status of STATUS_SLUGS) {
          let offset = 0;
          const limit = 100;
          while (true) {
            const result: any = await page.evaluate(
              async ({ userId, status, limit, offset }) => {
                const qs = `user_id=${userId}&sort=-apply_time,-create_time&limit=${limit}&offset=${offset}&status=${status}&includes=summary`;
                const res = await fetch(`/api/v1/applications?${qs}`, { credentials: 'include' });
                if (!res.ok) return null;
                return res.json();
              },
              { userId, status, limit, offset },
            );
            if (!result) break;
            const items: any[] = result.applications ?? [];
            for (const item of items) {
              all.push({
                wanted_job_id: item.job_id || item.job?.id || 0,
                company_name: item.company_name || item.job?.company_name || '',
                position: item.job?.position || item.position || '',
                status: item.status || status,
                applied_at: item.create_time,
              });
            }
            if (items.length < limit) break;
            offset += limit;
          }
        }
        return all;
      } finally {
        await page.close();
      }
    });
  }

  async fetchNotifications(since?: string): Promise<WantedNotification[]> {
    return this.session.withSession(async (context) => {
      const page = await context.newPage();
      try {
        await page.goto('https://www.wanted.co.kr/status/applications/applied', {
          waitUntil: 'domcontentloaded',
          timeout: 15_000,
        });
        const result: any = await page.evaluate(async () => {
          const res = await fetch('/api/v1/notifications?limit=20', { credentials: 'include' });
          if (!res.ok) return null;
          return res.json();
        });
        const notifs: WantedNotification[] = (result?.notifications ?? [])
          .filter((n: any) => n.push_type === 'application' && n.text && !n.text.includes('이력서를 제출'))
          .map((n: any) => ({ text: n.text, time: n.time, push_value: String(n.push_value) }));

        if (!since) return notifs;
        return notifs.filter((n) => n.time > since);
      } finally {
        await page.close();
      }
    });
  }
}
