export interface UserSettings {
  discord_id: string;
  role: string;
  tech_stack: string;
  include_keywords: string;
  exclude_keywords: string;
  location: string;
  exp: number;
  exp_min: number;
  exp_max: number;
  paused: number;
  alert_channel: string;
  last_notif_time?: string;
}

export interface AppliedJob {
  wanted_job_id: number;
  company_name: string;
  position: string;
  status: string;
  applied_at?: string;
}

export interface CollectedJob {
  wanted_job_id: number;
  position: string;
  company_name: string;
  location?: string;
  annual_from?: number;
  annual_to?: number;
  detail_intro?: string;
  detail_main_tasks?: string;
  detail_requirements?: string;
  detail_preferred?: string;
  skill_tags?: string;
  score?: number;
  classification?: string;
}
