import { Injectable, OnModuleInit } from '@nestjs/common';
import Database from 'better-sqlite3';
import path from 'path';
import { UserSettings, AppliedJob, CollectedJob } from './db.types';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  discord_id      TEXT PRIMARY KEY,
  role            TEXT NOT NULL DEFAULT 'backend',
  include_keywords TEXT NOT NULL DEFAULT '',
  exclude_keywords TEXT NOT NULL DEFAULT '',
  location        TEXT NOT NULL DEFAULT '서울',
  exp             INTEGER NOT NULL DEFAULT 0,
  paused          INTEGER NOT NULL DEFAULT 0,
  alert_channel   TEXT NOT NULL DEFAULT '',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS applied_jobs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  discord_id      TEXT NOT NULL,
  wanted_job_id   INTEGER NOT NULL,
  company_name    TEXT NOT NULL,
  position        TEXT NOT NULL,
  status          TEXT NOT NULL,
  applied_at      TEXT,
  last_checked_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(discord_id, wanted_job_id)
);

CREATE TABLE IF NOT EXISTS collected_jobs (
  wanted_job_id       INTEGER PRIMARY KEY,
  position            TEXT NOT NULL,
  company_name        TEXT NOT NULL,
  location            TEXT,
  annual_from         INTEGER,
  annual_to           INTEGER,
  detail_intro        TEXT,
  detail_main_tasks   TEXT,
  detail_requirements TEXT,
  detail_preferred    TEXT,
  skill_tags          TEXT,
  score               REAL,
  classification      TEXT,
  collected_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

@Injectable()
export class DbService implements OnModuleInit {
  private db!: Database.Database;

  onModuleInit() {
    this.db = new Database(path.resolve('chuipo.db'));
    this.db.pragma('journal_mode = WAL');
    this.db.exec(SCHEMA);
    try {
      this.db.exec(`ALTER TABLE users ADD COLUMN tech_stack TEXT NOT NULL DEFAULT ''`);
    } catch {}
  }

  getUser(discordId: string): UserSettings | undefined {
    return this.db
      .prepare('SELECT * FROM users WHERE discord_id = ?')
      .get(discordId) as UserSettings | undefined;
  }

  upsertUser(discordId: string, settings: Partial<Omit<UserSettings, 'discord_id'>>): void {
    const allowed = new Set<string>([
      'role', 'tech_stack', 'include_keywords', 'exclude_keywords',
      'location', 'exp', 'paused', 'alert_channel',
    ]);
    const safeSettings = Object.fromEntries(
      Object.entries(settings).filter(([k]) => allowed.has(k)),
    );

    const existing = this.getUser(discordId);
    if (existing) {
      const fields = Object.keys(safeSettings).map((k) => `${k} = @${k}`).join(', ');
      if (!fields) return;
      this.db
        .prepare(`UPDATE users SET ${fields}, updated_at = datetime('now') WHERE discord_id = @discord_id`)
        .run({ ...safeSettings, discord_id: discordId });
    } else {
      const cols = ['discord_id', ...Object.keys(safeSettings)];
      const vals = cols.map((c) => `@${c}`).join(', ');
      this.db
        .prepare(`INSERT INTO users (${cols.join(', ')}) VALUES (${vals})`)
        .run({ ...safeSettings, discord_id: discordId });
    }
  }

  getAllActiveUsers(): UserSettings[] {
    return this.db.prepare('SELECT * FROM users WHERE paused = 0').all() as UserSettings[];
  }

  getAppliedJobs(discordId: string): AppliedJob[] {
    return this.db
      .prepare('SELECT wanted_job_id, company_name, position, status, applied_at FROM applied_jobs WHERE discord_id = ?')
      .all(discordId) as AppliedJob[];
  }

  upsertAppliedJob(discordId: string, job: AppliedJob): { changed: boolean; oldStatus?: string } {
    const existing = this.db
      .prepare('SELECT status FROM applied_jobs WHERE discord_id = ? AND wanted_job_id = ?')
      .get(discordId, job.wanted_job_id) as { status: string } | undefined;

    if (existing) {
      const changed = existing.status !== job.status;
      if (changed) {
        this.db
          .prepare(
            `UPDATE applied_jobs SET status = ?, company_name = ?, position = ?, last_checked_at = datetime('now')
             WHERE discord_id = ? AND wanted_job_id = ?`,
          )
          .run(job.status, job.company_name, job.position, discordId, job.wanted_job_id);
      }
      return { changed, oldStatus: existing.status };
    }

    this.db
      .prepare(
        `INSERT INTO applied_jobs (discord_id, wanted_job_id, company_name, position, status, applied_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(discordId, job.wanted_job_id, job.company_name, job.position, job.status, job.applied_at ?? null);
    return { changed: true };
  }

  getSeenJobIds(): Set<number> {
    const rows = this.db
      .prepare("SELECT wanted_job_id FROM collected_jobs WHERE collected_at > datetime('now', '-90 days')")
      .all() as { wanted_job_id: number }[];
    return new Set(rows.map((r) => r.wanted_job_id));
  }

  insertJob(job: CollectedJob): void {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO collected_jobs
         (wanted_job_id, position, company_name, location, annual_from, annual_to,
          detail_intro, detail_main_tasks, detail_requirements, detail_preferred,
          skill_tags, score, classification)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        job.wanted_job_id, job.position, job.company_name,
        job.location ?? null, job.annual_from ?? null, job.annual_to ?? null,
        job.detail_intro ?? null, job.detail_main_tasks ?? null,
        job.detail_requirements ?? null, job.detail_preferred ?? null,
        job.skill_tags ?? null, job.score ?? null, job.classification ?? null,
      );
  }
}
