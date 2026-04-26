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

  private buildEmbed(app: any, oldStatus: string): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle(app.position)
      .setColor(STATUS_COLORS[app.status] || 0x95a5a6)
      .addFields(
        { name: '회사', value: app.company_name, inline: true },
        { name: '상태', value: `${STATUS_LABELS[oldStatus] ?? oldStatus} → **${STATUS_LABELS[app.status] ?? app.status}**`, inline: true },
      )
      .setURL(`https://www.wanted.co.kr/wd/${app.wanted_job_id}`)
      .setTimestamp();
  }

  async execute(interaction: ChatInputCommandInteraction) {
    const user = await this.db.getUser(interaction.user.id);
    if (!user) {
      await interaction.reply({ content: '먼저 `/setup`을 실행해주세요.', flags: 64 });
      return;
    }
    await interaction.deferReply({ flags: 64 });

    try {
      const applications = await this.applied.fetchApplications();
      const changed: { app: typeof applications[0]; oldStatus: string }[] = [];

      for (const app of applications) {
        const result = await this.db.upsertAppliedJob(user.discord_id, app);
        if (result.changed && result.oldStatus) changed.push({ app, oldStatus: result.oldStatus });
      }

      if (changed.length === 0) {
        await interaction.editReply({ content: '변경 사항이 없습니다.' });
        return;
      }

      const batches: typeof changed[] = [];
      for (let i = 0; i < changed.length; i += 10) batches.push(changed.slice(i, i + 10));

      await interaction.editReply({
        content: `${changed.length}건 변경됨`,
        embeds: batches[0].map(({ app, oldStatus }) => this.buildEmbed(app, oldStatus)),
      });

      for (const batch of batches.slice(1)) {
        await interaction.followUp({ embeds: batch.map(({ app, oldStatus }) => this.buildEmbed(app, oldStatus)), flags: 64 });
      }
    } catch (err: any) {
      const msg =
        err.message === 'SESSION_EXPIRED' || err.message === 'SESSION_NOT_FOUND'
          ? '세션이 만료되었습니다. `/login`을 실행해주세요.'
          : '지원 현황 조회 중 오류가 발생했습니다.';
      await interaction.editReply({ content: msg });
    }
  }
}
