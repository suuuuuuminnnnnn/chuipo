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

  @Cron(process.env.CRON_APPLIED_SCHEDULE || '*/10 * * * *')
  async checkApplicationUpdates() {
    const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    console.log(`[cron:applied] 시작 - ${now}`);

    if (!this.session.sessionExists()) {
      console.log('[cron:applied] 세션 없음, 건너뜀');
      return;
    }

    const ownerId = process.env.OWNER_DISCORD_ID;
    if (!ownerId) {
      console.warn('[cron:applied] OWNER_DISCORD_ID 환경변수가 없습니다.');
      return;
    }
    const owner = await this.db.getUser(ownerId);
    if (!owner) {
      console.warn(`[cron:applied] DB에 사용자 없음 (${ownerId})`);
      return;
    }

    let applications;
    try {
      applications = await this.applied.fetchApplications();
      console.log(`[cron:applied] 지원 현황 ${applications.length}건 수신`);
    } catch (err: any) {
      if (err.message === 'SESSION_EXPIRED' || err.message === 'SESSION_NOT_FOUND') {
        console.warn('[cron:applied] 세션 만료');
        await this.sendToChannel({
          content: `<@${owner.discord_id}> Wanted 세션이 만료되었습니다. 세션을 갱신해주세요.`,
        });
      } else {
        console.error('[cron:applied] fetchApplications 실패:', err);
      }
      return;
    }

    // 새 알림 체크 (이력서 확인 등)
    try {
      const newNotifs = await this.applied.fetchNotifications(owner.last_notif_time ?? undefined);
      if (newNotifs.length > 0) {
        console.log(`[cron:applied] 새 알림 ${newNotifs.length}건`);
        for (const notif of newNotifs) {
          console.log(`[cron:applied] 알림: ${notif.text} (${notif.time})`);
          await this.sendToChannel({ content: `<@${owner.discord_id}> 📬 ${notif.text}` });
        }
        const latest = newNotifs.reduce((a, b) => (a.time > b.time ? a : b));
        await this.db.upsertUser(owner.discord_id, { last_notif_time: latest.time });
      } else {
        console.log('[cron:applied] 새 알림 없음');
      }
    } catch (err) {
      console.error('[cron:applied] 알림 조회 실패:', err);
    }

    let changedCount = 0;
    for (const app of applications) {
      const result = await this.db.upsertAppliedJob(owner.discord_id, app);
      console.log(`[cron:applied] ${app.company_name} / ${app.position} → ${app.status}${result.changed && result.oldStatus ? ` (변경: ${result.oldStatus} → ${app.status})` : ''}`);
      if (result.changed && result.oldStatus) {
        changedCount++;
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
    console.log(`[cron:applied] 완료 - 총 ${applications.length}건 중 ${changedCount}건 변경`);
  }

  @Cron(process.env.CRON_JOBS_SCHEDULE || '0 */2 * * *')
  async collectAndNotifyJobs() {
    const users = await this.db.getAllActiveUsers();
    if (users.length === 0) return;

    const seenIds = await this.db.getSeenJobIds();
    const allNewJobs = new Map<number, WantedJobDetail>();

    for (const user of users) {
      let fetched;
      try {
        fetched = await this.jobs.fetchNewJobs(seenIds);
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
      await this.db.insertJob({
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
            annual_from: job.annual_from,
            annual_to: job.annual_to,
          },
          {
            techStack: user.tech_stack,
            include: user.include_keywords,
            exclude: user.exclude_keywords,
            expMin: user.exp_min,
            expMax: user.exp_max,
          },
        );
        if (result.classification !== 'reject') {
          userJobs.push({ job, score: result.totalScore, cls: result.classification });
        }
      }

      if (userJobs.length === 0) continue;
      userJobs.sort((a, b) => b.score - a.score);

      const backendCount = userJobs.filter((j) => j.cls === 'backend').length;
      const reviewCount = userJobs.filter((j) => j.cls === 'review').length;

      const embeds = userJobs.slice(0, 10).map(({ job, score, cls }) => {
        const expText =
          job.annual_from != null || job.annual_to != null
            ? `${job.annual_from ?? 0}~${job.annual_to ?? ''}년`
            : '미공개';
        return new EmbedBuilder()
          .setTitle(`[${cls.toUpperCase()}] ${job.position}`)
          .setColor(cls === 'backend' ? 0x2ecc71 : 0xf39c12)
          .addFields(
            { name: '회사', value: job.company_name || '미공개', inline: true },
            { name: '위치', value: job.location || '미공개', inline: true },
            { name: '경력', value: expText, inline: true },
            { name: '점수', value: `${score}점`, inline: true },
          )
          .setURL(`https://www.wanted.co.kr/wd/${job.wanted_job_id}`)
          .setTimestamp();
      });

      await this.sendToChannel({
        content: `<@${user.discord_id}> 새 공고 ${userJobs.length}건 (추천: ${backendCount} | 검토: ${reviewCount})`,
        embeds,
      });
    }
  }
}
