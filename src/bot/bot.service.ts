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
      try {
        if (interaction.isChatInputCommand()) {
          await this.commands.handle(interaction);
        } else if (interaction.isModalSubmit()) {
          await this.commands.handleModal(interaction);
        }
      } catch (err: any) {
        if (err?.code === 10062) return;
        console.error(`[bot] 인터랙션 오류:`, err);
        const reply = { content: '오류가 발생했습니다.', flags: 64 };
        if ('replied' in interaction && (interaction.replied || (interaction as any).deferred)) {
          await (interaction as any).editReply({ content: reply.content }).catch(() => {});
        } else if ('reply' in interaction) {
          await (interaction as any).reply(reply).catch(() => {});
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
