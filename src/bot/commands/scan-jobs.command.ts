import { Injectable } from '@nestjs/common';
import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { DbService } from '../../db/db.service';
import { JobsService, WantedJobDetail } from '../../wanted/jobs.service';
import { ScorerService, ScoreResult } from '../../scorer/scorer.service';
import { BotCommand } from './base.command';

@Injectable()
export class ScanJobsCommand implements BotCommand {
  constructor(
    private readonly db: DbService,
    private readonly jobs: JobsService,
    private readonly scorer: ScorerService,
  ) {}

  readonly data = new SlashCommandBuilder()
    .setName('scan-jobs')
    .setDescription('새 공고를 수집하고 점수화합니다');

  private buildEmbed(job: WantedJobDetail, result: ScoreResult): EmbedBuilder {
    const color = result.classification === 'backend' ? 0x2ecc71 : 0xf39c12;
    const expText =
      job.annual_from != null || job.annual_to != null
        ? `${job.annual_from ?? 0}~${job.annual_to ?? ''}년`
        : '미공개';

    return new EmbedBuilder()
      .setTitle(`[${result.classification.toUpperCase()}] ${job.position}`)
      .setColor(color)
      .addFields(
        { name: '회사', value: job.company_name || '미공개', inline: true },
        { name: '위치', value: job.location || '미공개', inline: true },
        { name: '경력', value: expText, inline: true },
        { name: '점수', value: `${result.totalScore}점`, inline: true },
        { name: '매칭 키워드', value: result.matchedKeywords.map((k) => k.keyword).join(', ') || '없음' },
      )
      .setURL(`https://www.wanted.co.kr/wd/${job.wanted_job_id}`)
      .setFooter({ text: `Chuipo Score: ${result.totalScore}` })
      .setTimestamp();
  }

  async execute(interaction: ChatInputCommandInteraction) {
    const user = this.db.getUser(interaction.user.id);
    if (!user) {
      await interaction.reply({ content: '먼저 `/setup`을 실행해주세요.', flags: 64 });
      return;
    }
    await interaction.deferReply();

    try {
      const seenIds = this.db.getSeenJobIds();
      const newJobs = await this.jobs.fetchNewJobs(seenIds);

      if (newJobs.length === 0) {
        await interaction.editReply({ content: '새로운 공고가 없습니다.' });
        return;
      }

      const scored: { job: WantedJobDetail; result: ScoreResult }[] = [];
      for (const job of newJobs) {
        const jobInput = {
          position: job.position,
          detail_intro: job.detail_intro,
          detail_main_tasks: job.detail_main_tasks,
          detail_requirements: job.detail_requirements,
          detail_preferred: job.detail_preferred,
          skill_tags: job.skill_tags,
        };

        // DB에는 범용 점수 저장
        const baseResult = this.scorer.score(jobInput);
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
          score: baseResult.totalScore,
          classification: baseResult.classification,
        });

        // 유저에게 표시할 점수는 유저 키워드 반영
        const userResult = this.scorer.scoreForUser(jobInput, {
          techStack: user.tech_stack,
          include: user.include_keywords,
          exclude: user.exclude_keywords,
        });
        if (userResult.classification !== 'reject') scored.push({ job, result: userResult });
      }

      scored.sort((a, b) => b.result.totalScore - a.result.totalScore);

      const backendCount = scored.filter((s) => s.result.classification === 'backend').length;
      const reviewCount = scored.filter((s) => s.result.classification === 'review').length;
      const rejectCount = newJobs.length - scored.length;

      const summary = [
        `총 ${newJobs.length}개의 새 공고를 분석했습니다.`,
        `추천: ${backendCount}개 | 검토: ${reviewCount}개 | 제외: ${rejectCount}개`,
        scored.length > 10 ? '(상위 10개만 표시)' : '',
      ].filter(Boolean).join('\n');

      await interaction.editReply({
        content: summary,
        embeds: scored.slice(0, 10).map((s) => this.buildEmbed(s.job, s.result)),
      });
    } catch (err) {
      console.error('[scan-jobs]', err);
      await interaction.editReply({ content: '공고 수집 중 오류가 발생했습니다.' });
    }
  }
}
