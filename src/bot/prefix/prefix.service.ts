import { Injectable } from '@nestjs/common';
import { Message, EmbedBuilder, TextChannel } from 'discord.js';
import { DbService } from '../../db/db.service';
import { AppliedService } from '../../wanted/applied.service';
import { JobsService } from '../../wanted/jobs.service';
import { ScorerService } from '../../scorer/scorer.service';
import { SessionService } from '../../wanted/session.service';
import { STATUS_COLORS, STATUS_LABELS } from '../../config/status-colors';

const PREFIX = '!';


@Injectable()
export class PrefixService {
  constructor(
    private readonly db: DbService,
    private readonly applied: AppliedService,
    private readonly jobs: JobsService,
    private readonly scorer: ScorerService,
    private readonly session: SessionService,
  ) {}

  async handle(message: Message): Promise<void> {
    if (!message.content.startsWith(PREFIX) || message.author.bot) return;

    const full = message.content.slice(PREFIX.length).trim();
    const [cmd, ...args] = full.split(/\s+/);

    switch (cmd) {
      case '설정': return this.setup(message, args);
      case '내설정': return this.mySettings(message);
      case '지원현황': return this.scanApplied(message);
      case '공고조회': return this.scanJobs(message);
      case '알림정지': return this.pause(message);
      case '알림재개': return this.resume(message);
      case '로그인': return this.login(message, args);
      case '명령어':
      case '도움말': await this.help(message); return;
    }
  }

  private async setup(message: Message, args: string[]) {
    // !설정 [role] [tech_stack] [location] [exp]
    const [role, techStack, location, expStr] = args;
    if (!role) {
      await message.reply('사용법: `!설정 [직군] [기술스택,쉼표구분] [위치] [경력]`\n예: `!설정 backend kotlin,spring 서울 3`');
      return;
    }
    const validRoles = ['backend', 'frontend', 'fullstack', 'devops', 'data'];
    if (!validRoles.includes(role)) {
      await message.reply(`직군은 ${validRoles.join(', ')} 중 하나여야 합니다.`);
      return;
    }
    const exp = expStr ? parseInt(expStr, 10) : 0;
    this.db.upsertUser(message.author.id, {
      role,
      tech_stack: techStack || '',
      location: location || '서울',
      exp: isNaN(exp) ? 0 : exp,
    });
    const embed = new EmbedBuilder()
      .setTitle('설정 완료')
      .setColor(0x2ecc71)
      .addFields(
        { name: '역할', value: role, inline: true },
        { name: '경력', value: `${isNaN(exp) ? 0 : exp}년`, inline: true },
        { name: '위치', value: location || '서울', inline: true },
        { name: '기술 스택', value: techStack || '없음' },
      );
    await message.reply({ embeds: [embed] });
  }

  private async mySettings(message: Message) {
    const user = this.db.getUser(message.author.id);
    if (!user) { await message.reply('먼저 `!설정`을 실행해주세요.'); return; }
    const embed = new EmbedBuilder()
      .setTitle('내 설정')
      .setColor(0x3498db)
      .addFields(
        { name: '역할', value: user.role, inline: true },
        { name: '경력', value: `${user.exp}년`, inline: true },
        { name: '위치', value: user.location, inline: true },
        { name: '기술 스택', value: user.tech_stack || '없음' },
        { name: '포함 키워드', value: user.include_keywords || '없음' },
        { name: '제외 키워드', value: user.exclude_keywords || '없음' },
        { name: '알림 상태', value: user.paused ? '일시정지' : '활성', inline: true },
      );
    await message.reply({ embeds: [embed] });
  }

  private async scanApplied(message: Message) {
    if (!this.db.getUser(message.author.id)) { await message.reply('먼저 `!설정`을 실행해주세요.'); return; }
    const loading = await message.reply('지원 현황 조회 중...');
    try {
      const applications = await this.applied.fetchApplications();
      const changed: { app: typeof applications[0]; oldStatus: string }[] = [];
      for (const app of applications) {
        const result = this.db.upsertAppliedJob(message.author.id, app);
        if (result.changed && result.oldStatus) changed.push({ app, oldStatus: result.oldStatus });
      }
      if (changed.length === 0) {
        await loading.edit('변경 사항이 없습니다.');
        return;
      }
      const embeds = changed.slice(0, 10).map(({ app, oldStatus }) =>
        new EmbedBuilder()
          .setTitle(app.position)
          .setColor(STATUS_COLORS[app.status] || 0x95a5a6)
          .addFields(
            { name: '회사', value: app.company_name, inline: true },
            { name: '상태', value: `${STATUS_LABELS[oldStatus] ?? oldStatus} → **${STATUS_LABELS[app.status] ?? app.status}**`, inline: true },
          )
          .setURL(`https://www.wanted.co.kr/wd/${app.wanted_job_id}`)
          .setTimestamp(),
      );
      await loading.edit({ content: `${changed.length}건 변경됨`, embeds });
      for (let i = 10; i < changed.length; i += 10) {
        await (message.channel as TextChannel).send({ embeds: changed.slice(i, i + 10).map(({ app, oldStatus }) =>
          new EmbedBuilder()
            .setTitle(app.position)
            .setColor(STATUS_COLORS[app.status] || 0x95a5a6)
            .addFields(
              { name: '회사', value: app.company_name, inline: true },
              { name: '상태', value: `${STATUS_LABELS[oldStatus] ?? oldStatus} → **${STATUS_LABELS[app.status] ?? app.status}**`, inline: true },
            )
            .setURL(`https://www.wanted.co.kr/wd/${app.wanted_job_id}`)
            .setTimestamp(),
        ) });
      }
    } catch (err: any) {
      const msg = (err.message === 'SESSION_EXPIRED' || err.message === 'SESSION_NOT_FOUND')
        ? '세션이 만료되었습니다. `!로그인 이메일 비밀번호`를 실행해주세요.'
        : '지원 현황 조회 중 오류가 발생했습니다.';
      await loading.edit(msg);
    }
  }

  private async scanJobs(message: Message) {
    const user = this.db.getUser(message.author.id);
    if (!user) { await message.reply('먼저 `!설정`을 실행해주세요.'); return; }
    const loading = await message.reply('공고 수집 중...');
    try {
      const newJobs = await this.jobs.fetchNewJobs(new Set<number>(), { limit: 100 });
      const scored: { job: typeof newJobs[0]; totalScore: number; cls: string }[] = [];
      for (const job of newJobs) {
        const jobInput = {
          position: job.position,
          detail_intro: job.detail_intro,
          detail_main_tasks: job.detail_main_tasks,
          detail_requirements: job.detail_requirements,
          detail_preferred: job.detail_preferred,
          skill_tags: job.skill_tags,
        };
        const result = this.scorer.scoreForUser(jobInput, {
          techStack: user.tech_stack,
          include: user.include_keywords,
          exclude: user.exclude_keywords,
        });
        if (result.classification !== 'reject') scored.push({ job, totalScore: result.totalScore, cls: result.classification });
      }
      scored.sort((a, b) => b.totalScore - a.totalScore);
      if (scored.length === 0) {
        await loading.edit('조건에 맞는 공고가 없습니다.');
        return;
      }
      const backendCount = scored.filter((s) => s.cls === 'backend').length;
      const reviewCount = scored.filter((s) => s.cls === 'review').length;
      const embeds = scored.slice(0, 10).map(({ job, totalScore, cls }) =>
        new EmbedBuilder()
          .setTitle(`[${cls === 'backend' ? '추천' : '검토'}] ${job.position}`)
          .setColor(cls === 'backend' ? 0x2ecc71 : 0xf39c12)
          .addFields(
            { name: '회사', value: job.company_name || '미공개', inline: true },
            { name: '점수', value: `${totalScore}점`, inline: true },
          )
          .setURL(`https://www.wanted.co.kr/wd/${job.wanted_job_id}`)
          .setTimestamp(),
      );
      await loading.edit({ content: `${newJobs.length}개 분석 | 추천 ${backendCount}개 | 검토 ${reviewCount}개`, embeds });
    } catch (err) {
      console.error('[prefix:공고조회]', err);
      await loading.edit('공고 수집 중 오류가 발생했습니다.');
    }
  }

  private async help(message: Message) {
    const embed = new EmbedBuilder()
      .setTitle('명령어 목록')
      .setColor(0x3498db)
      .addFields(
        {
          name: '⚙️ 설정',
          value: [
            '`!설정 [직군] [기술스택] [위치] [경력]` — 초기 설정',
            '> 예: `!설정 backend kotlin,spring 서울 3`',
            '> 직군: backend / frontend / fullstack / devops / data',
            '`!내설정` — 현재 설정 확인',
          ].join('\n'),
        },
        {
          name: '🔍 조회',
          value: [
            '`!지원현황` — 지원 상태 변경 확인',
            '`!공고조회` — 조건에 맞는 공고 수집 & 점수화',
          ].join('\n'),
        },
        {
          name: '🔔 알림',
          value: [
            '`!알림정지` — 자동 알림 일시정지',
            '`!알림재개` — 자동 알림 재개',
          ].join('\n'),
        },
        {
          name: '🔑 로그인',
          value: '`!로그인 이메일 비밀번호` — Wanted 세션 저장\n> 비밀번호가 노출될 수 있으니 DM에서 사용 권장',
        },
      )
      .setFooter({ text: '크론: 지원현황 30분 / 공고수집 2시간 자동 실행' });
    await message.reply({ embeds: [embed] });
  }

  private async pause(message: Message) {
    if (!this.db.getUser(message.author.id)) { await message.reply('먼저 `!설정`을 실행해주세요.'); return; }
    this.db.upsertUser(message.author.id, { paused: 1 });
    await message.reply('알림을 일시정지했습니다.');
  }

  private async resume(message: Message) {
    if (!this.db.getUser(message.author.id)) { await message.reply('먼저 `!설정`을 실행해주세요.'); return; }
    this.db.upsertUser(message.author.id, { paused: 0 });
    await message.reply('알림을 재개했습니다.');
  }

  private async login(message: Message, args: string[]) {
    const [email, password] = args;
    if (!email || !password) { await message.reply('사용법: `!로그인 이메일 비밀번호`'); return; }
    await message.delete().catch(() => {});
    const loading = await (message.channel as TextChannel).send('Wanted 로그인 중...');
    try {
      await this.session.login(email, password);
      await loading.edit('로그인 완료! 세션이 저장되었습니다.');
    } catch (err: any) {
      await loading.edit(`로그인 실패: ${err.message}`);
    }
  }
}
