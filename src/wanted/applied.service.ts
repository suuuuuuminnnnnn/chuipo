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
      const allApplications: any[] = [];
      let capturedTotal = 0;

      page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('/api/v1/applications') && response.status() === 200) {
          try {
            const json = await response.json();
            if (Array.isArray(json.applications)) {
              allApplications.push(...json.applications);
              capturedTotal = json.total ?? json.applications.length;
            }
          } catch {}
        }
      });

      try {
        await page.goto('https://www.wanted.co.kr/status/applications', {
          waitUntil: 'networkidle',
          timeout: 30_000,
        });
        await page.waitForTimeout(3000);

        if (allApplications.length > 0 && allApplications.length < capturedTotal) {
          const remaining = Math.ceil((capturedTotal - allApplications.length) / 10);
          for (let p = 2; p <= remaining + 1; p++) {
            await page.goto(
              `https://www.wanted.co.kr/status/applications/applied?page=${p}&offset=${(p - 1) * 10}&limit=10`,
              { waitUntil: 'networkidle', timeout: 30_000 },
            );
            await page.waitForTimeout(2000);
          }
        }

        return allApplications.map((item: any) => ({
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
