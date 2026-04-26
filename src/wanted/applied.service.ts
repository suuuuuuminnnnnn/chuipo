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
        await page.goto('https://www.wanted.co.kr', { waitUntil: 'domcontentloaded', timeout: 15_000 });

        const userId = await page.evaluate(async () => {
          const candidates = ['/api/v4/me', '/api/v4/users/me', '/api/v1/users/me'];
          for (const url of candidates) {
            try {
              const res = await fetch(url, { credentials: 'include' });
              if (!res.ok) continue;
              const data = await res.json();
              const id = data?.id || data?.user?.id;
              if (id) return id;
            } catch {}
          }
          return null;
        });

        if (!userId) {
          console.error('[applied] userId 조회 실패');
          return [];
        }

        const all: ApplicationStatus[] = [];
        let offset = 0;
        const limit = 100;

        while (true) {
          const result = await page.evaluate(async ({ userId, limit, offset }) => {
            const qs = `user_id=${userId}&sort=-apply_time,-create_time&limit=${limit}&offset=${offset}&status=complete,+pass,+hire,+reject&includes=summary`;
            const res = await fetch(`/api/v1/applications?${qs}`, { credentials: 'include' });
            if (!res.ok) return null;
            return res.json();
          }, { userId, limit, offset });

          if (!result) {
            console.error('[applied] /api/v1/applications 실패');
            break;
          }

          const items: any[] = result.applications ?? [];
          all.push(...items.map((item: any) => ({
            wanted_job_id: item.job_id || item.job?.id || 0,
            company_name: item.company_name || item.job?.company_name || '',
            position: item.job?.position || '',
            status: item.status || '지원완료',
            applied_at: item.create_time,
          })));

          if (all.length >= (result.total ?? items.length) || items.length < limit) break;
          offset += limit;
        }

        return all;
      } finally {
        await page.close();
      }
    });
  }
}
