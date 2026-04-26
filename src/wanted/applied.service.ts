import { Injectable } from '@nestjs/common';
import { SessionService } from './session.service';

export interface ApplicationStatus {
  wanted_job_id: number;
  company_name: string;
  position: string;
  status: string;
  applied_at?: string;
}

const BASE = 'https://www.wanted.co.kr';

@Injectable()
export class AppliedService {
  constructor(private readonly session: SessionService) {}

  async fetchApplications(): Promise<ApplicationStatus[]> {
    return this.session.withSession(async (context) => {
      const page = await context.newPage();
      try {
        await page.goto(`${BASE}/api/v4/me`, {
          waitUntil: 'domcontentloaded',
          timeout: 15_000,
        });

        const meText = await page.evaluate(() => document.body.innerText);
        let me: any;
        try { me = JSON.parse(meText); } catch {
          console.error('[applied] /api/v4/me 파싱 실패:', meText?.slice(0, 200));
          return [];
        }

        const userId = me?.id || me?.user?.id;
        if (!userId) {
          console.error('[applied] userId 없음:', me);
          return [];
        }

        const all: any[] = [];
        let offset = 0;
        const limit = 100;

        while (true) {
          const qs = new URLSearchParams({
            user_id: String(userId),
            sort: '-apply_time,-create_time',
            limit: String(limit),
            offset: String(offset),
            status: 'complete,+pass,+hire,+reject',
            includes: 'summary',
          });

          await page.goto(`${BASE}/api/v1/applications?${qs}`, {
            waitUntil: 'domcontentloaded',
            timeout: 15_000,
          });

          const text = await page.evaluate(() => document.body.innerText);
          let json: any;
          try { json = JSON.parse(text); } catch {
            console.error('[applied] /api/v1/applications 파싱 실패');
            break;
          }

          const items: any[] = json.applications ?? [];
          all.push(...items);
          if (all.length >= (json.total ?? items.length) || items.length < limit) break;
          offset += limit;
        }

        return all.map((item: any) => ({
          wanted_job_id: item.job_id || item.job?.id || 0,
          company_name: item.company_name || item.job?.company_name || '',
          position: item.job?.position || '',
          status: item.status || '지원완료',
          applied_at: item.create_time,
        }));
      } finally {
        await page.close();
      }
    });
  }
}
