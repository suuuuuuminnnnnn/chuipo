import { Module } from '@nestjs/common';
import { CommandsModule } from './commands/commands.module';
import { BotService } from './bot.service';

@Module({
  imports: [CommandsModule],
  providers: [BotService],
  exports: [BotService],
})
export class BotModule {}
