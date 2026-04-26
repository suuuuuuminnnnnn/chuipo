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
      const captured: any[] = [];

      page.on('response', async (response) => {
        if (response.url().includes('/api/v1/applications') && response.status() === 200) {
          try {
            const json = await response.json();
            if (json.applications) captured.push(json);
          } catch {}
        }
      });

      try {
        await page.goto('https://www.wanted.co.kr/my-activity/applications', {
          waitUntil: 'networkidle',
          timeout: 30_000,
        });

        if (captured.length === 0) {
          console.error('[applied] 지원 현황 API 응답 없음');
          return [];
        }

        const all: ApplicationStatus[] = [];
        for (const json of captured) {
          for (const item of json.applications ?? []) {
            all.push({
              wanted_job_id: item.job_id || item.job?.id || 0,
              company_name: item.company_name || item.job?.company_name || '',
              position: item.job?.position || '',
              status: item.status || '지원완료',
              applied_at: item.create_time,
            });
          }
        }
        return all;
      } finally {
        await page.close();
      }
    });
  }
}
