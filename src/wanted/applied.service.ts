import { Injectable } from '@nestjs/common';
import { SessionService, STATE_FILE } from './session.service';
import fs from 'fs';

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
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

@Injectable()
export class AppliedService {
  constructor(private readonly session: SessionService) {}

  private cookieHeader(): string {
    const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    return (state.cookies as any[])
      .filter((c) => c.domain.endsWith('wanted.co.kr'))
      .map((c) => `${c.name}=${c.value}`)
      .join('; ');
  }

  private async wFetch(path: string): Promise<any> {
    const res = await fetch(`https://www.wanted.co.kr${path}`, {
      headers: {
        Cookie: this.cookieHeader(),
        'User-Agent': UA,
        Referer: 'https://www.wanted.co.kr/',
      },
    });
    if (res.status === 401) throw new Error('SESSION_EXPIRED');
    if (res.redirected && res.url.includes('id.wanted.co.kr')) throw new Error('SESSION_EXPIRED');
    if (!res.ok) return null;
    return res.json();
  }

  async fetchApplications(): Promise<ApplicationStatus[]> {
    if (!this.session.sessionExists()) throw new Error('SESSION_NOT_FOUND');

    const me = await this.wFetch('/api/v4/me');
    if (!me) throw new Error('SESSION_EXPIRED');
    const userId = me.id;

    const all: ApplicationStatus[] = [];
    for (const status of STATUS_SLUGS) {
      let offset = 0;
      const limit = 100;
      while (true) {
        const qs = `user_id=${userId}&sort=-apply_time,-create_time&limit=${limit}&offset=${offset}&status=${status}&includes=summary`;
        const data = await this.wFetch(`/api/v1/applications?${qs}`);
        if (!data) break;
        const items: any[] = data.applications ?? [];
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
  }

  async fetchNotifications(since?: string): Promise<WantedNotification[]> {
    if (!this.session.sessionExists()) throw new Error('SESSION_NOT_FOUND');

    const data = await this.wFetch('/api/v1/notifications?limit=20');
    const notifs: WantedNotification[] = (data?.notifications ?? [])
      .filter((n: any) => n.push_type === 'application' && n.text && !n.text.includes('이력서를 제출'))
      .map((n: any) => ({ text: n.text, time: n.time, push_value: String(n.push_value) }));

    if (!since) return notifs;
    return notifs.filter((n) => n.time > since);
  }
}
