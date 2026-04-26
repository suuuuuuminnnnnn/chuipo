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
      let capturedData: any = null;

      page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('/applications') && response.status() === 200) {
          try {
            const json = await response.json();
            if (json?.data?.length > 0) capturedData = json;
          } catch {}
        }
      });

      try {
        await page.goto('https://www.wanted.co.kr/status/applications', {
          waitUntil: 'networkidle',
          timeout: 30_000,
        });
        await page.waitForTimeout(3000);

        if (capturedData?.data?.length > 0) {
          return capturedData.data.map((item: any) => ({
            wanted_job_id: item.job?.id || item.job_id || item.id || 0,
            company_name: item.job?.company?.name || item.company?.name || item.company_name || '',
            position: item.job?.position || item.position || '',
            status: item.status || item.application_status || '지원완료',
            applied_at: item.created_at,
          }));
        }

        console.warn('[applied] 네트워크 응답 캡처 실패 - DOM fallback 시도');

        const items = await page.$$eval(
          '[class*="Application"], [class*="application"], [class*="StatusItem"]',
          (els) =>
            els.map((el) => {
              const getText = (selectors: string[]) => {
                for (const s of selectors) {
                  const node = el.querySelector(s);
                  if (node?.textContent?.trim()) return node.textContent.trim();
                }
                return '';
              };
              return {
                company_name: getText(['[class*="company"]', '[class*="Company"]']),
                position: getText(['[class*="position"]', '[class*="Position"]', '[class*="title"]']),
                status: getText(['[class*="status"]', '[class*="Status"]', '[class*="badge"]']),
                link: (el.querySelector('a') as HTMLAnchorElement | null)?.href || '',
              };
            }),
        );

        if (items.length === 0) {
          console.warn('[applied] DOM scraping도 빈 결과');
        }

        return items.map((item) => {
          const idMatch = item.link.match(/\/wd\/(\d+)/);
          return {
            wanted_job_id: idMatch ? parseInt(idMatch[1]) : 0,
            company_name: item.company_name,
            position: item.position,
            status: item.status || '지원완료',
          };
        });
      } finally {
        await page.close();
      }
    });
  }
}
