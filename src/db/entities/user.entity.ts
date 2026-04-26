import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryColumn({ type: 'text' })
  discord_id: string;

  @Column({ type: 'text', default: 'backend' })
  role: string;

  @Column({ type: 'text', default: '' })
  tech_stack: string;

  @Column({ type: 'text', default: '' })
  include_keywords: string;

  @Column({ type: 'text', default: '' })
  exclude_keywords: string;

  @Column({ type: 'text', default: '서울' })
  location: string;

  @Column({ type: 'integer', default: 0 })
  exp: number;

  @Column({ type: 'integer', default: 0 })
  exp_min: number;

  @Column({ type: 'integer', default: 20 })
  exp_max: number;

  @Column({ type: 'integer', default: 0 })
  paused: number;

  @Column({ type: 'text', default: '' })
  alert_channel: string;

  @Column({ type: 'text', default: () => "datetime('now')" })
  created_at: string;

  @Column({ type: 'text', default: () => "datetime('now')" })
  updated_at: string;
}
