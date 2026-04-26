import { Injectable } from '@nestjs/common';
import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { DbService } from '../../db/db.service';
import { BotCommand } from './base.command';

@Injectable()
export class SetLocationCommand implements BotCommand {
  constructor(private readonly db: DbService) {}

  readonly data = new SlashCommandBuilder()
    .setName('set-location')
    .setDescription('희망 근무지를 변경합니다')
    .addStringOption((o) => o.setName('location').setDescription('희망 근무지').setRequired(true));

  async execute(interaction: ChatInputCommandInteraction) {
    if (!await this.db.getUser(interaction.user.id)) {
      await interaction.reply({ content: '먼저 `/setup`을 실행해주세요.', flags: 64 });
      return;
    }
    const location = interaction.options.getString('location', true);
    await this.db.upsertUser(interaction.user.id, { location });
    await interaction.reply({ content: `근무지가 **${location}**(으)로 변경되었습니다.`, flags: 64 });
  }
}
