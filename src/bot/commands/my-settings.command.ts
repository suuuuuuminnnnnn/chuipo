import { Injectable } from '@nestjs/common';
import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { DbService } from '../../db/db.service';
import { BotCommand } from './base.command';

@Injectable()
export class MySettingsCommand implements BotCommand {
  constructor(private readonly db: DbService) {}

  readonly data = new SlashCommandBuilder()
    .setName('my-settings')
    .setDescription('내 설정을 확인합니다');

  async execute(interaction: ChatInputCommandInteraction) {
    const user = this.db.getUser(interaction.user.id);
    if (!user) {
      await interaction.reply({ content: '먼저 `/setup`을 실행해주세요.', ephemeral: true });
      return;
    }
    const embed = new EmbedBuilder()
      .setTitle('내 설정')
      .setColor(0x3498db)
      .addFields(
        { name: '역할', value: user.role, inline: true },
        { name: '경력', value: `${user.exp}년`, inline: true },
        { name: '위치', value: user.location, inline: true },
        { name: '포함 키워드', value: user.include_keywords || '없음' },
        { name: '제외 키워드', value: user.exclude_keywords || '없음' },
        { name: '알림 채널', value: `<#${user.alert_channel}>`, inline: true },
        { name: '알림 상태', value: user.paused ? '일시정지' : '활성', inline: true },
      );
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}
