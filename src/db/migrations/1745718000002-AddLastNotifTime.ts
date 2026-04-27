import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLastNotifTime1745718000002 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    const cols: { name: string }[] = await queryRunner.query(`PRAGMA table_info('users')`);
    if (!cols.some((c) => c.name === 'last_notif_time')) {
      await queryRunner.query(`ALTER TABLE users ADD COLUMN last_notif_time TEXT`);
    }
  }
  async down(queryRunner: QueryRunner): Promise<void> {}
}
