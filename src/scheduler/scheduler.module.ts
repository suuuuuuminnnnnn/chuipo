import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { BotModule } from '../bot/bot.module';
import { DbModule } from '../db/db.module';
import { WantedModule } from '../wanted/wanted.module';
import { ScorerModule } from '../scorer/scorer.module';
import { SchedulerService } from './scheduler.service';

@Module({
  imports: [ScheduleModule.forRoot(), BotModule, DbModule, WantedModule, ScorerModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
