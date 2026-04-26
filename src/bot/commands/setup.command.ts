import { Injectable } from '@nestjs/common';
import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ModalSubmitInteraction,
} from 'discord.js';
import { DbService } from '../../db/db.service';
import { BotCommand } from './base.command';

export const SETUP_MODAL_ID = 'setup-modal';

@Injectable()
export class SetupCommand implements BotCommand {
  constructor(private readonly db: DbService) {}

  readonly data = new SlashCommandBuilder()
    .setName('setup')
    .setDescription('설정을 조회하거나 수정합니다 (기존 값이 미리 채워집니다)');

  async execute(interaction: ChatInputCommandInteraction) {
    const user = await this.db.getUser(interaction.user.id);

    const modal = new ModalBuilder()
      .setCustomId(SETUP_MODAL_ID)
      .setTitle('설정');

    const fields = [
      new TextInputBuilder()
        .setCustomId('role')
        .setLabel('직군 (backend / frontend / fullstack / devops / data)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setValue(user?.role ?? 'backend'),
      new TextInputBuilder()
        .setCustomId('tech_stack')
        .setLabel('기술 스택 (쉼표 구분, 없으면 공고 제외)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setValue(user?.tech_stack ?? ''),
      new TextInputBuilder()
        .setCustomId('location')
        .setLabel('희망 근무지')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setValue(user?.location ?? '서울'),
      new TextInputBuilder()
        .setCustomId('exp_info')
        .setLabel('경력: 내 경력 / 공고 최소 / 공고 최대 (예: 3 / 0 / 5)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setValue(`${user?.exp ?? 0} / ${user?.exp_min ?? 0} / ${user?.exp_max ?? 20}`),
      new TextInputBuilder()
        .setCustomId('keywords')
        .setLabel('포함키워드 / 제외키워드 (쉼표 구분, | 로 구분)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setValue(`${user?.include_keywords ?? ''} | ${user?.exclude_keywords ?? ''}`),
    ];

    for (const field of fields) {
      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(field));
    }

    await interaction.showModal(modal);
  }

  async handleModalSubmit(interaction: ModalSubmitInteraction) {
    const role = interaction.fields.getTextInputValue('role').trim().toLowerCase();
    const validRoles = ['backend', 'frontend', 'fullstack', 'devops', 'data'];
    if (!validRoles.includes(role)) {
      await interaction.reply({
        content: `직군은 ${validRoles.join(', ')} 중 하나여야 합니다.`,
        flags: 64,
      });
      return;
    }

    const tech_stack = interaction.fields.getTextInputValue('tech_stack').trim();
    const location = interaction.fields.getTextInputValue('location').trim() || '서울';

    const expRaw = interaction.fields.getTextInputValue('exp_info').trim();
    const expParts = expRaw.split('/').map((s) => parseInt(s.trim(), 10));
    const exp = isNaN(expParts[0]) ? 0 : expParts[0];
    const exp_min = isNaN(expParts[1]) ? 0 : expParts[1];
    const exp_max = isNaN(expParts[2]) ? 20 : expParts[2];

    const keywordsRaw = interaction.fields.getTextInputValue('keywords').trim();
    const [incRaw, excRaw] = keywordsRaw.split('|');
    const include_keywords = (incRaw ?? '').trim();
    const exclude_keywords = (excRaw ?? '').trim();

    await this.db.upsertUser(interaction.user.id, {
      role, tech_stack, location, exp, exp_min, exp_max, include_keywords, exclude_keywords,
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
