import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('collected_jobs')
export class CollectedJob {
  @PrimaryColumn({ type: 'integer' })
  wanted_job_id: number;

  @Column({ type: 'text' })
  position: string;

  @Column({ type: 'text' })
  company_name: string;

  @Column({ type: 'text', nullable: true })
  location: string | null;

  @Column({ type: 'integer', nullable: true })
  annual_from: number | null;

  @Column({ type: 'integer', nullable: true })
  annual_to: number | null;

  @Column({ type: 'text', nullable: true })
  detail_intro: string | null;

  @Column({ type: 'text', nullable: true })
  detail_main_tasks: string | null;

  @Column({ type: 'text', nullable: true })
  detail_requirements: string | null;

  @Column({ type: 'text', nullable: true })
  detail_preferred: string | null;

  @Column({ type: 'text', nullable: true })
  skill_tags: string | null;

  @Column({ type: 'real', nullable: true })
  score: number | null;

  @Column({ type: 'text', nullable: true })
  classification: string | null;

  @Column({ type: 'text', default: () => "datetime('now')" })
  collected_at: string;
}
