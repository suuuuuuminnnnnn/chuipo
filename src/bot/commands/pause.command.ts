import { Injectable } from '@nestjs/common';
import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { DbService } from '../../db/db.service';
import { BotCommand } from './base.command';

@Injectable()
export class PauseCommand implements BotCommand {
  constructor(private readonly db: DbService) {}

  readonly data = new SlashCommandBuilder()
    .setName('pause')
    .setDescription('알림을 일시정지합니다');

  async execute(interaction: ChatInputCommandInteraction) {
    const user = await this.db.getUser(interaction.user.id);
    if (!user) {
      await interaction.reply({ content: '먼저 `/setup`을 실행해주세요.', flags: 64 });
      return;
    }
    if (user.paused) {
      await interaction.reply({ content: '이미 일시정지 상태입니다.', flags: 64 });
      return;
    }
    await this.db.upsertUser(interaction.user.id, { paused: 1 });
    await interaction.reply({ content: '알림이 일시정지되었습니다. `/resume`으로 재개할 수 있습니다.', flags: 64 });
  }
}
