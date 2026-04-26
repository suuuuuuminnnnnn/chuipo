import { Injectable } from '@nestjs/common';
import { SessionService } from './session.service';

export interface ApplicationStatus {
  wanted_job_id: number;
  company_name: string;
  position: string;
  status: string;
  applied_at?: string;
}

@Injectable()
export class AppliedService {
  constructor(private readonly session: SessionService) {}

  async fetchApplications(): Promise<ApplicationStatus[]> {
    return this.session.withSession(async (context) => {
      const page = await context.newPage();
      try {
        await page.goto('https://www.wanted.co.kr', {
          waitUntil: 'domcontentloaded',
          timeout: 20_000,
        });

        const result: any = await page.evaluate(async () => {
          const meRes = await fetch('/api/v4/me', { credentials: 'include' });
          if (!meRes.ok) return { error: 'me_failed', status: meRes.status };
          const me = await meRes.json();
          const userId = me?.id || me?.user?.id;
          if (!userId) return { error: 'no_user_id', me };

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
            const res = await fetch(`/api/v1/applications?${qs}`, { credentials: 'include' });
            if (!res.ok) return { error: 'applications_failed', status: res.status };
            const json = await res.json();
            const items: any[] = json.applications ?? [];
            all.push(...items);
            if (all.length >= (json.total ?? items.length) || items.length < limit) break;
            offset += limit;
          }

          return { applications: all };
        });

        if (result.error) {
          console.error('[applied] API 오류:', result);
          return [];
        }

        return (result.applications ?? []).map((item: any) => ({
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
