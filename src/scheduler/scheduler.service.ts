import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EmbedBuilder, TextChannel } from 'discord.js';
import { DbService } from '../db/db.service';
import { AppliedService } from '../wanted/applied.service';
import { JobsService, WantedJobDetail } from '../wanted/jobs.service';
import { ScorerService } from '../scorer/scorer.service';
import { SessionService } from '../wanted/session.service';
import { BotService } from '../bot/bot.service';
import { STATUS_COLORS, STATUS_LABELS } from '../config/status-colors';

@Injectable()
export class SchedulerService {
  constructor(
    private readonly db: DbService,
    private readonly session: SessionService,
    private readonly applied: AppliedService,
    private readonly jobs: JobsService,
    private readonly scorer: ScorerService,
    private readonly bot: BotService,
  ) {}

  private async sendToChannel(payload: { content?: string; embeds?: EmbedBuilder[] }) {
    const channelId = process.env.ALERT_CHANNEL_ID;
    if (!channelId) return;
    try {
      const channel = await this.bot.client.channels.fetch(channelId);
      if (!channel || !(channel instanceof TextChannel)) return;
      await channel.send({ content: payload.content, embeds: payload.embeds });
    } catch (err) {
      console.error('[channel] 전송 실패:', err);
    }
  }

  @Cron(process.env.CRON_APPLIED_SCHEDULE || '*/30 * * * *')
  async checkApplicationUpdates() {
    if (!this.session.sessionExists()) return;

    const ownerId = process.env.OWNER_DISCORD_ID;
    if (!ownerId) {
      console.warn('[cron:applied] OWNER_DISCORD_ID 환경변수가 없습니다.');
      return;
    }
    const owner = this.db.getUser(ownerId);
    if (!owner) return;

    let applications;
    try {
      applications = await this.applied.fetchApplications();
    } catch (err: any) {
      if (err.message === 'SESSION_EXPIRED' || err.message === 'SESSION_NOT_FOUND') {
        await this.sendToChannel({
          content: `<@${owner.discord_id}> Wanted 세션이 만료되었습니다. 세션을 갱신해주세요.`,
        });
      } else {
        console.error('[cron:applied]', err);
      }
      return;
    }

    for (const app of applications) {
      const result = this.db.upsertAppliedJob(owner.discord_id, app);
      if (result.changed && result.oldStatus) {
        const oldLabel = STATUS_LABELS[result.oldStatus] ?? result.oldStatus;
        const newLabel = STATUS_LABELS[app.status] ?? app.status;
        const embed = new EmbedBuilder()
          .setTitle('지원 현황 업데이트')
          .setColor(STATUS_COLORS[app.status] || 0x95a5a6)
          .addFields(
            { name: '회사', value: app.company_name, inline: true },
            { name: '포지션', value: app.position, inline: true },
            { name: '상태 변경', value: `${oldLabel} → **${newLabel}**` },
          )
          .setURL(`https://www.wanted.co.kr/wd/${app.wanted_job_id}`)
          .setTimestamp();

        await this.sendToChannel({
          content: `<@${owner.discord_id}>`,
          embeds: [embed],
        });
      }
    }
  }

  @Cron(process.env.CRON_JOBS_SCHEDULE || '0 */2 * * *')
  async collectAndNotifyJobs() {
    const users = this.db.getAllActiveUsers();
    if (users.length === 0) return;

    // 유저별 설정(role/location/exp)으로 각각 fetch, job ID로 중복 제거
    const seenIds = this.db.getSeenJobIds();
    const allNewJobs = new Map<number, WantedJobDetail>();

    for (const user of users) {
      let fetched;
      try {
        fetched = await this.jobs.fetchNewJobs(seenIds, {
          years: user.exp,
          locations: user.location,
        });
      } catch (err) {
        console.error(`[cron:jobs] fetch 실패 (user=${user.discord_id}):`, err);
        continue;
      }
      for (const job of fetched) {
        if (!allNewJobs.has(job.wanted_job_id)) {
          allNewJobs.set(job.wanted_job_id, job);
          seenIds.add(job.wanted_job_id);
        }
      }
    }

    if (allNewJobs.size === 0) return;

    const newJobs = [...allNewJobs.values()];

    for (const job of newJobs) {
      const result = this.scorer.score({
        position: job.position,
        detail_intro: job.detail_intro,
        detail_main_tasks: job.detail_main_tasks,
        detail_requirements: job.detail_requirements,
        detail_preferred: job.detail_preferred,
        skill_tags: job.skill_tags,
      });
      this.db.insertJob({
        wanted_job_id: job.wanted_job_id,
        position: job.position,
        company_name: job.company_name,
        location: job.location,
        annual_from: job.annual_from,
        annual_to: job.annual_to,
        detail_intro: job.detail_intro,
        detail_main_tasks: job.detail_main_tasks,
        detail_requirements: job.detail_requirements,
        detail_preferred: job.detail_preferred,
        skill_tags: job.skill_tags ? JSON.stringify(job.skill_tags) : undefined,
        score: result.totalScore,
        classification: result.classification,
      });
    }

    for (const user of users) {
      const userJobs: { job: typeof newJobs[0]; score: number; cls: string }[] = [];

      for (const job of newJobs) {
        const result = this.scorer.scoreForUser(
          {
            position: job.position,
            detail_intro: job.detail_intro,
            detail_main_tasks: job.detail_main_tasks,
            detail_requirements: job.detail_requirements,
            detail_preferred: job.detail_preferred,
            skill_tags: job.skill_tags,
          },
          { techStack: user.tech_stack, include: user.include_keywords, exclude: user.exclude_keywords },
        );
        if (result.classification !== 'reject') {
          userJobs.push({ job, score: result.totalScore, cls: result.classification });
        }
      }

      if (userJobs.length === 0) continue;
      userJobs.sort((a, b) => b.score - a.score);

      const backendCount = userJobs.filter((j) => j.cls === 'backend').length;
      const reviewCount = userJobs.filter((j) => j.cls === 'review').length;

      const embeds = userJobs.slice(0, 10).map(({ job, score, cls }) =>
        new EmbedBuilder()
          .setTitle(`[${cls.toUpperCase()}] ${job.position}`)
          .setColor(cls === 'backend' ? 0x2ecc71 : 0xf39c12)
          .addFields(
            { name: '회사', value: job.company_name || '미공개', inline: true },
            { name: '위치', value: job.location || '미공개', inline: true },
            { name: '점수', value: `${score}점`, inline: true },
          )
          .setURL(`https://www.wanted.co.kr/wd/${job.wanted_job_id}`)
          .setTimestamp(),
      );

      await this.sendToChannel({
        content: `<@${user.discord_id}> 새 공고 ${userJobs.length}건 (추천: ${backendCount} | 검토: ${reviewCount})`,
        embeds,
      });
    }
  }
}
