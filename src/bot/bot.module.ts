import { Module } from '@nestjs/common';
import { CommandsModule } from './commands/commands.module';
import { BotService } from './bot.service';
import { PrefixService } from './prefix/prefix.service';
import { DbModule } from '../db/db.module';
import { WantedModule } from '../wanted/wanted.module';
import { ScorerModule } from '../scorer/scorer.module';

@Module({
  imports: [CommandsModule, DbModule, WantedModule, ScorerModule],
  providers: [BotService, PrefixService],
  exports: [BotService],
})
export class BotModule {}
