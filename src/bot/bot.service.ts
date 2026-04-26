import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Client, Events, GatewayIntentBits } from 'discord.js';
import { CommandsService } from './commands/commands.service';

@Injectable()
export class BotService implements OnModuleInit, OnModuleDestroy {
  readonly client = new Client({ intents: [GatewayIntentBits.Guilds] });

  constructor(private readonly commands: CommandsService) {}

  async onModuleInit() {
    const token = process.env.DISCORD_TOKEN;
    if (!token) throw new Error('.env에 DISCORD_TOKEN을 설정해주세요.');

    this.client.on(Events.ClientReady, (c) => {
      console.log(`[Chuipo] ${c.user.tag} 로그인 완료`);
    });

    this.client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isChatInputCommand()) return;
      try {
        await this.commands.handle(interaction);
      } catch (err) {
        console.error(`[bot] 커맨드 오류 (${interaction.commandName}):`, err);
        const opts = { content: '오류가 발생했습니다.', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.editReply({ content: opts.content }).catch(() => {});
        } else {
          await interaction.reply(opts).catch(() => {});
        }
      }
    });

    await this.client.login(token);
  }

  async onModuleDestroy() {
    this.client.destroy();
  }
}
