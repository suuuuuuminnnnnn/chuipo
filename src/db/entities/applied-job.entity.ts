import { Entity, PrimaryGeneratedColumn, Column, Unique } from 'typeorm';

@Entity('applied_jobs')
@Unique(['discord_id', 'wanted_job_id'])
export class AppliedJob {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text' })
  discord_id: string;

  @Column({ type: 'integer' })
  wanted_job_id: number;

  @Column({ type: 'text' })
  company_name: string;

  @Column({ type: 'text' })
  position: string;

  @Column({ type: 'text' })
  status: string;

  @Column({ type: 'text', nullable: true })
  applied_at: string | null;

  @Column({ type: 'text', default: () => "datetime('now')" })
  last_checked_at: string;
}
