import { Injectable } from '@nestjs/common';
import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { DbService } from '../../db/db.service';
import { AppliedService } from '../../wanted/applied.service';
import { BotCommand } from './base.command';
import { STATUS_COLORS, STATUS_LABELS } from '../../config/status-colors';

@Injectable()
export class ScanAppliedCommand implements BotCommand {
  constructor(
    private readonly db: DbService,
    private readonly applied: AppliedService,
  ) {}

  readonly data = new SlashCommandBuilder()
    .setName('scan-applied')
    .setDescription('지원 현황을 즉시 조회합니다');

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: 64 });

    if (!this.db.getUser(interaction.user.id)) {
      await interaction.editReply({ content: '먼저 `/setup`을 실행해주세요.' });
      return;
    }

    try {
      const applications = await this.applied.fetchApplications();
      if (applications.length === 0) {
        await interaction.editReply({ content: '지원 내역이 없습니다.' });
        return;
      }

      const changed: { app: typeof applications[0]; oldStatus: string }[] = [];
      for (const app of applications) {
        const result = this.db.upsertAppliedJob(interaction.user.id, app);
        if (result.changed && result.oldStatus) {
          changed.push({ app, oldStatus: result.oldStatus });
        }
      }

      if (changed.length === 0) {
        await interaction.editReply({ content: '변경 사항이 없습니다.' });
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

      await interaction.editReply({
        content: `${changed.length}건 변경됨`,
        embeds,
      });
    } catch (err: any) {
      if (err.message === 'SESSION_EXPIRED' || err.message === 'SESSION_NOT_FOUND') {
        await interaction.editReply({ content: '세션이 만료되었습니다. `npm run wanted:login`을 실행해주세요.' });
        return;
      }
      console.error('[scan-applied]', err);
      await interaction.editReply({ content: '지원 현황 조회 중 오류가 발생했습니다.' });
    }
  }
}
