import { Injectable } from '@nestjs/common';
import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { SessionService } from '../../wanted/session.service';
import { BotCommand } from './base.command';

@Injectable()
export class LoginCommand implements BotCommand {
  constructor(private readonly session: SessionService) {}

  readonly data = new SlashCommandBuilder()
    .setName('login')
    .setDescription('Wanted 로그인 (세션 저장)')
    .addStringOption((o) => o.setName('email').setDescription('Wanted 이메일').setRequired(true))
    .addStringOption((o) => o.setName('password').setDescription('Wanted 비밀번호').setRequired(true));

  async execute(interaction: ChatInputCommandInteraction) {
    const ownerId = process.env.OWNER_DISCORD_ID;
    if (ownerId && interaction.user.id !== ownerId) {
      await interaction.reply({ content: '이 커맨드는 봇 소유자만 사용할 수 있습니다.', flags: 64 });
      return;
    }

    const email = interaction.options.getString('email', true);
    const password = interaction.options.getString('password', true);

    await interaction.deferReply({ flags: 64 });

    try {
      await this.session.login(email, password);
      await interaction.editReply('Wanted 로그인 성공. 세션이 저장되었습니다.');
    } catch (err: any) {
      await interaction.editReply(`로그인 실패: ${err.message}`);
    }
  }
}
