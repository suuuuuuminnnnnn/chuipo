import { Injectable } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { User } from './entities/user.entity';
import { AppliedJob } from './entities/applied-job.entity';
import { CollectedJob } from './entities/collected-job.entity';
import { UserSettings, AppliedJob as AppliedJobType, CollectedJob as CollectedJobType } from './db.types';

@Injectable()
export class DbService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(AppliedJob) private readonly appliedRepo: Repository<AppliedJob>,
    @InjectRepository(CollectedJob) private readonly collectedRepo: Repository<CollectedJob>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async getUser(discordId: string): Promise<UserSettings | null> {
    return this.userRepo.findOne({ where: { discord_id: discordId } }) as Promise<UserSettings | null>;
  }

  async upsertUser(discordId: string, settings: Partial<Omit<UserSettings, 'discord_id'>>): Promise<void> {
    const existing = await this.userRepo.findOne({ where: { discord_id: discordId } });
    if (existing) {
      await this.userRepo.update({ discord_id: discordId }, {
        ...settings,
        updated_at: new Date().toISOString(),
      } as any);
    } else {
      await this.userRepo.save({ discord_id: discordId, ...settings } as User);
    }
  }

  async getAllActiveUsers(): Promise<UserSettings[]> {
    return this.userRepo.find({ where: { paused: 0 } }) as Promise<UserSettings[]>;
  }

  async getAppliedJobs(discordId: string): Promise<AppliedJobType[]> {
    const rows = await this.appliedRepo.find({ where: { discord_id: discordId } });
    return rows.map((r) => ({
      wanted_job_id: r.wanted_job_id,
      company_name: r.company_name,
      position: r.position,
      status: r.status,
      applied_at: r.applied_at ?? undefined,
    }));
  }

  async upsertAppliedJob(
    discordId: string,
    job: AppliedJobType,
  ): Promise<{ changed: boolean; oldStatus?: string }> {
    const existing = await this.appliedRepo.findOne({
      where: { discord_id: discordId, wanted_job_id: job.wanted_job_id },
    });

    if (existing) {
      const changed = existing.status !== job.status;
      if (changed) {
        await this.appliedRepo.update(
          { discord_id: discordId, wanted_job_id: job.wanted_job_id },
          {
            status: job.status,
            company_name: job.company_name,
            position: job.position,
            last_checked_at: new Date().toISOString(),
          },
        );
      }
      return { changed, oldStatus: existing.status };
    }

    await this.appliedRepo.save({
      discord_id: discordId,
      wanted_job_id: job.wanted_job_id,
      company_name: job.company_name,
      position: job.position,
      status: job.status,
      applied_at: job.applied_at ?? null,
    } as AppliedJob);
    return { changed: true };
  }

  async getSeenJobIds(): Promise<Set<number>> {
    const rows: { wanted_job_id: number }[] = await this.dataSource.query(
      `SELECT wanted_job_id FROM collected_jobs WHERE collected_at > datetime('now', '-90 days')`,
    );
    return new Set(rows.map((r) => r.wanted_job_id));
  }

  async insertJob(job: CollectedJobType): Promise<void> {
    await this.dataSource.query(
      `INSERT OR IGNORE INTO collected_jobs
       (wanted_job_id, position, company_name, location, annual_from, annual_to,
        detail_intro, detail_main_tasks, detail_requirements, detail_preferred,
        skill_tags, score, classification)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        job.wanted_job_id,
        job.position,
        job.company_name,
        job.location ?? null,
        job.annual_from ?? null,
        job.annual_to ?? null,
        job.detail_intro ?? null,
        job.detail_main_tasks ?? null,
        job.detail_requirements ?? null,
        job.detail_preferred ?? null,
        job.skill_tags ?? null,
        job.score ?? null,
        job.classification ?? null,
      ],
    );
  }
}
