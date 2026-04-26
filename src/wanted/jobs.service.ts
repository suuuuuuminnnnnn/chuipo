import { Injectable } from '@nestjs/common';

export interface WantedJob {
  wanted_job_id: number;
  position: string;
  company_name: string;
  location?: string;
  annual_from?: number;
  annual_to?: number;
}

export interface WantedJobDetail extends WantedJob {
  detail_intro?: string;
  detail_main_tasks?: string;
  detail_requirements?: string;
  detail_preferred?: string;
  skill_tags?: string[];
}

const BASE_URL = 'https://www.wanted.co.kr/api/v4';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Referer': 'https://www.wanted.co.kr/',
  'Origin': 'https://www.wanted.co.kr',
};


@Injectable()
export class JobsService {
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async fetchJobList(params: {
    tagTypeId?: number;
    offset?: number;
    limit?: number;
  } = {}): Promise<WantedJob[]> {
    const qs = new URLSearchParams({
      country: 'kr',
      tag_type_ids: String(params.tagTypeId || 518),
      job_sort: 'job.latest_order',
      years: '-1',
      locations: 'all',
      limit: String(params.limit || 20),
      offset: String(params.offset || 0),
    });

    const url = `${BASE_URL}/jobs?${qs}`;
    console.log('[jobs] 요청 URL:', url);
    const res = await fetch(url, { headers: HEADERS });
    console.log('[jobs] 응답 상태:', res.status);
    if (!res.ok) {
      const body = await res.text();
      console.error('[jobs] 응답 바디:', body.slice(0, 300));
      throw new Error(`Wanted API 오류: ${res.status}`);
    }

    const json: any = await res.json();
    console.log('[jobs] 응답 바디:', JSON.stringify(json).slice(0, 300));
    return (json.data || []).map((job: any) => ({
      wanted_job_id: job.id,
      position: job.position,
      company_name: job.company?.name || '',
      location: job.address?.full_location,
      annual_from: job.annual_from,
      annual_to: job.annual_to,
    }));
  }

  async fetchJobDetail(jobId: number): Promise<WantedJobDetail> {
    const res = await fetch(`${BASE_URL}/jobs/${jobId}`, { headers: HEADERS });
    if (!res.ok) throw new Error(`Wanted 상세 조회 오류: ${res.status}`);

    const json: any = await res.json();
    const job = json.job || json;

    return {
      wanted_job_id: job.id || jobId,
      position: job.position || '',
      company_name: job.company?.name || '',
      location: job.address?.full_location,
      annual_from: job.annual_from,
      annual_to: job.annual_to,
      detail_intro: job.detail?.intro,
      detail_main_tasks: job.detail?.main_tasks,
      detail_requirements: job.detail?.requirements,
      detail_preferred: job.detail?.preferred_points,
      skill_tags: job.skill_tags?.map((t: any) =>
        typeof t === 'string' ? t : (t.title || t.name || String(t)),
      ),
    };
  }

  async fetchNewJobs(
    seenIds: Set<number>,
    params?: Parameters<typeof this.fetchJobList>[0],
  ): Promise<WantedJobDetail[]> {
    const list = await this.fetchJobList(params);
    const newJobs = list.filter((j) => !seenIds.has(j.wanted_job_id));

    const details: WantedJobDetail[] = [];
    for (const job of newJobs) {
      try {
        details.push(await this.fetchJobDetail(job.wanted_job_id));
      } catch (err) {
        console.error(`공고 상세 조회 실패 (${job.wanted_job_id}):`, err);
      }
      await this.sleep(1000);
    }
    return details;
  }
}
