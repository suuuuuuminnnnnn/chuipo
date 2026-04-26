import { Injectable } from '@nestjs/common';
import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { DbService } from '../../db/db.service';
import { BotCommand } from './base.command';

@Injectable()
export class ResumeCommand implements BotCommand {
  constructor(private readonly db: DbService) {}

  readonly data = new SlashCommandBuilder()
    .setName('resume')
    .setDescription('알림을 재개합니다');

  async execute(interaction: ChatInputCommandInteraction) {
    const user = this.db.getUser(interaction.user.id);
    if (!user) {
      await interaction.reply({ content: '먼저 `/setup`을 실행해주세요.', ephemeral: true });
      return;
    }
    if (!user.paused) {
      await interaction.reply({ content: '이미 활성 상태입니다.', ephemeral: true });
      return;
    }
    this.db.upsertUser(interaction.user.id, { paused: 0 });
    await interaction.reply({ content: '알림이 재개되었습니다.', ephemeral: true });
  }
}
