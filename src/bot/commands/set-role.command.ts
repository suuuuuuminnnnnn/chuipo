import { Injectable } from '@nestjs/common';
import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { DbService } from '../../db/db.service';
import { BotCommand } from './base.command';

@Injectable()
export class SetRoleCommand implements BotCommand {
  constructor(private readonly db: DbService) {}

  readonly data = new SlashCommandBuilder()
    .setName('set-role')
    .setDescription('희망 직군을 변경합니다')
    .addStringOption((o) =>
      o.setName('role').setDescription('희망 직군').setRequired(true).addChoices(
        { name: 'Backend', value: 'backend' },
        { name: 'Frontend', value: 'frontend' },
        { name: 'Fullstack', value: 'fullstack' },
        { name: 'DevOps', value: 'devops' },
        { name: 'Data', value: 'data' },
      ),
    );

  async execute(interaction: ChatInputCommandInteraction) {
    if (!this.db.getUser(interaction.user.id)) {
      await interaction.reply({ content: '먼저 `/setup`을 실행해주세요.', flags: 64 });
      return;
    }
    const role = interaction.options.getString('role', true);
    this.db.upsertUser(interaction.user.id, { role });
    await interaction.reply({ content: `역할이 **${role}**로 변경되었습니다.`, flags: 64 });
  }
}
