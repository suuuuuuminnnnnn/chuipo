import { ChatInputCommandInteraction } from 'discord.js';

export interface BotCommand {
  readonly data: { name: string; toJSON(): unknown };
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
}
