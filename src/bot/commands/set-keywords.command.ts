import { Injectable } from '@nestjs/common';
import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { DbService } from '../../db/db.service';
import { BotCommand } from './base.command';

@Injectable()
export class SetKeywordsCommand implements BotCommand {
  constructor(private readonly db: DbService) {}

  readonly data = new SlashCommandBuilder()
    .setName('set-keywords')
    .setDescription('포함/제외 키워드를 변경합니다')
    .addStringOption((o) => o.setName('include').setDescription('포함할 키워드 (쉼표 구분)').setRequired(false))
    .addStringOption((o) => o.setName('exclude').setDescription('제외할 키워드 (쉼표 구분)').setRequired(false));

  async execute(interaction: ChatInputCommandInteraction) {
    if (!this.db.getUser(interaction.user.id)) {
      await interaction.reply({ content: '먼저 `/setup`을 실행해주세요.', flags: 64 });
      return;
    }
    const include = interaction.options.getString('include');
    const exclude = interaction.options.getString('exclude');
    if (include === null && exclude === null) {
      await interaction.reply({ content: 'include 또는 exclude 중 하나 이상을 입력해주세요.', flags: 64 });
      return;
    }
    const updates: { include_keywords?: string; exclude_keywords?: string } = {};
    if (include !== null) updates.include_keywords = include;
    if (exclude !== null) updates.exclude_keywords = exclude;
    this.db.upsertUser(interaction.user.id, updates);
    const parts: string[] = [];
    if (include !== null) parts.push(`포함: **${include || '없음'}**`);
    if (exclude !== null) parts.push(`제외: **${exclude || '없음'}**`);
    await interaction.reply({ content: `키워드 변경 완료\n${parts.join('\n')}`, flags: 64 });
  }
}
