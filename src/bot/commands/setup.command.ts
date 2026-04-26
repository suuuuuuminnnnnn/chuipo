import { Injectable } from '@nestjs/common';
import { ChatInputCommandInteraction, ChannelType, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { DbService } from '../../db/db.service';
import { BotCommand } from './base.command';

@Injectable()
export class SetupCommand implements BotCommand {
  constructor(private readonly db: DbService) {}

  readonly data = new SlashCommandBuilder()
    .setName('setup')
    .setDescription('초기 설정을 진행합니다')
    .addStringOption((o) =>
      o.setName('role').setDescription('희망 직군').setRequired(true).addChoices(
        { name: 'Backend', value: 'backend' },
        { name: 'Frontend', value: 'frontend' },
        { name: 'Fullstack', value: 'fullstack' },
        { name: 'DevOps', value: 'devops' },
        { name: 'Data', value: 'data' },
      ),
    )
    .addStringOption((o) =>
      o.setName('include_keywords').setDescription('포함할 키워드 (쉼표 구분)').setRequired(false),
    )
    .addStringOption((o) =>
      o.setName('exclude_keywords').setDescription('제외할 키워드 (쉼표 구분)').setRequired(false),
    )
    .addStringOption((o) =>
      o.setName('location').setDescription('희망 근무지 (기본: 서울)').setRequired(false),
    )
    .addIntegerOption((o) =>
      o.setName('exp').setDescription('경력 연수 (0=신입)').setMinValue(0).setMaxValue(20).setRequired(false),
    )
    .addChannelOption((o) =>
      o.setName('alert_channel').setDescription('알림 채널 (기본: 현재 채널)')
        .addChannelTypes(ChannelType.GuildText).setRequired(false),
    );

  async execute(interaction: ChatInputCommandInteraction) {
    const role = interaction.options.getString('role', true);
    const include_keywords = interaction.options.getString('include_keywords') || '';
    const exclude_keywords = interaction.options.getString('exclude_keywords') || '';
    const location = interaction.options.getString('location') || '서울';
    const exp = interaction.options.getInteger('exp') ?? 0;
    const alert_channel = interaction.options.getChannel('alert_channel')?.id || interaction.channelId;

    this.db.upsertUser(interaction.user.id, {
      role, include_keywords, exclude_keywords, location, exp, alert_channel,
    });

    const embed = new EmbedBuilder()
      .setTitle('설정 완료')
      .setColor(0x2ecc71)
      .addFields(
        { name: '역할', value: role, inline: true },
        { name: '경력', value: `${exp}년`, inline: true },
        { name: '위치', value: location, inline: true },
        { name: '포함 키워드', value: include_keywords || '없음' },
        { name: '제외 키워드', value: exclude_keywords || '없음' },
        { name: '알림 채널', value: `<#${alert_channel}>` },
      );

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}
