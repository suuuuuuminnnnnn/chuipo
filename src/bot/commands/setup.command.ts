import { Injectable } from '@nestjs/common';
import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
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
      o.setName('tech_stack').setDescription('선호 기술 스택 - 없으면 제외 (예: node.js,nestjs,typescript)').setRequired(false),
    )
    .addStringOption((o) =>
      o.setName('include_keywords').setDescription('포함 시 점수 보너스 키워드 (쉼표 구분)').setRequired(false),
    )
    .addStringOption((o) =>
      o.setName('exclude_keywords').setDescription('포함 시 무조건 제외 키워드 (쉼표 구분)').setRequired(false),
    )
    .addStringOption((o) =>
      o.setName('location').setDescription('희망 근무지 (기본: 서울)').setRequired(false),
    )
    .addIntegerOption((o) =>
      o.setName('exp').setDescription('내 경력 연수 (0=신입)').setMinValue(0).setMaxValue(20).setRequired(false),
    )
    .addIntegerOption((o) =>
      o.setName('exp_min').setDescription('공고 최소 경력 요건 (기본 0)').setMinValue(0).setMaxValue(20).setRequired(false),
    )
    .addIntegerOption((o) =>
      o.setName('exp_max').setDescription('공고 최대 경력 요건 (기본 20)').setMinValue(0).setMaxValue(20).setRequired(false),
    );

  async execute(interaction: ChatInputCommandInteraction) {
    const role = interaction.options.getString('role', true);
    const tech_stack = interaction.options.getString('tech_stack') || '';
    const include_keywords = interaction.options.getString('include_keywords') || '';
    const exclude_keywords = interaction.options.getString('exclude_keywords') || '';
    const location = interaction.options.getString('location') || '서울';
    const exp = interaction.options.getInteger('exp') ?? 0;
    const exp_min = interaction.options.getInteger('exp_min') ?? 0;
    const exp_max = interaction.options.getInteger('exp_max') ?? 20;

    await this.db.upsertUser(interaction.user.id, {
      role, tech_stack, include_keywords, exclude_keywords, location, exp, exp_min, exp_max,
    });

    const embed = new EmbedBuilder()
      .setTitle('설정 완료')
      .setColor(0x2ecc71)
      .addFields(
        { name: '역할', value: role, inline: true },
        { name: '내 경력', value: `${exp}년`, inline: true },
        { name: '위치', value: location, inline: true },
        { name: '공고 경력 범위', value: `${exp_min}~${exp_max}년`, inline: true },
        { name: '기술 스택', value: tech_stack || '없음' },
        { name: '포함 키워드', value: include_keywords || '없음' },
        { name: '제외 키워드', value: exclude_keywords || '없음' },
      );

    await interaction.reply({ embeds: [embed], flags: 64 });
  }
}
