import { MigrationInterface, QueryRunner } from 'typeorm';

export class BaselineSchema1745718000001 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
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
      )
    `);

    await queryRunner.query(`
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
      )
    `);

    await queryRunner.query(`
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
      )
    `);

    // 기존 DB에 없을 수 있는 컬럼들을 조건부로 추가
    const cols: { name: string }[] = await queryRunner.query(`PRAGMA table_info('users')`);
    const colNames = cols.map((c) => c.name);

    if (!colNames.includes('tech_stack')) {
      await queryRunner.query(`ALTER TABLE users ADD COLUMN tech_stack TEXT NOT NULL DEFAULT ''`);
    }
    if (!colNames.includes('exp_min')) {
      await queryRunner.query(`ALTER TABLE users ADD COLUMN exp_min INTEGER NOT NULL DEFAULT 0`);
    }
    if (!colNames.includes('exp_max')) {
      await queryRunner.query(`ALTER TABLE users ADD COLUMN exp_max INTEGER NOT NULL DEFAULT 20`);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS collected_jobs`);
    await queryRunner.query(`DROP TABLE IF EXISTS applied_jobs`);
    await queryRunner.query(`DROP TABLE IF EXISTS users`);
  }
}
