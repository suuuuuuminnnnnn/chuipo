import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Client, Events, GatewayIntentBits } from 'discord.js';
import { CommandsService } from './commands/commands.service';
import { PrefixService } from './prefix/prefix.service';

@Injectable()
export class BotService implements OnModuleInit, OnModuleDestroy {
  readonly client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  constructor(
    private readonly commands: CommandsService,
    private readonly prefix: PrefixService,
  ) {}

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
      } catch (err: any) {
        if (err?.code === 10062) return;
        console.error(`[bot] 커맨드 오류 (${interaction.commandName}):`, err);
        const reply = { content: '오류가 발생했습니다.', flags: 64 };
        if (interaction.replied || interaction.deferred) {
          await interaction.editReply({ content: reply.content }).catch(() => {});
        } else {
          await interaction.reply(reply).catch(() => {});
        }
      }
    });

    this.client.on(Events.MessageCreate, async (message) => {
      await this.prefix.handle(message);
    });

    await this.client.login(token);
  }

  async onModuleDestroy() {
    this.client.destroy();
  }
}
