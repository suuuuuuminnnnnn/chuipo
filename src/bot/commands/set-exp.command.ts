import { Injectable } from '@nestjs/common';
import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { DbService } from '../../db/db.service';
import { BotCommand } from './base.command';

@Injectable()
export class SetExpCommand implements BotCommand {
  constructor(private readonly db: DbService) {}

  readonly data = new SlashCommandBuilder()
    .setName('set-exp')
    .setDescription('경력 연수를 변경합니다')
    .addIntegerOption((o) =>
      o.setName('years').setDescription('경력 연수 (0=신입)').setMinValue(0).setMaxValue(20).setRequired(true),
    );

  async execute(interaction: ChatInputCommandInteraction) {
    if (!this.db.getUser(interaction.user.id)) {
      await interaction.reply({ content: '먼저 `/setup`을 실행해주세요.', ephemeral: true });
      return;
    }
    const exp = interaction.options.getInteger('years', true);
    this.db.upsertUser(interaction.user.id, { exp });
    await interaction.reply({ content: `경력이 **${exp}년**으로 변경되었습니다.`, ephemeral: true });
  }
}
