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
      const meRes = await context.request.get(`${BASE}/api/v4/me`);
      if (!meRes.ok()) {
        console.error('[applied] /api/v4/me 실패:', meRes.status());
        return [];
      }
      const me: any = await meRes.json();
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
        const res = await context.request.get(`${BASE}/api/v1/applications?${qs}`);
        if (!res.ok()) {
          console.error('[applied] /api/v1/applications 실패:', res.status());
          break;
        }
        const json: any = await res.json();
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
    });
  }
}
