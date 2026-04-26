import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DbModule } from '../db/db.module';
import { WantedModule } from '../wanted/wanted.module';
import { ScorerModule } from '../scorer/scorer.module';
import { SchedulerService } from './scheduler.service';

@Module({
  imports: [ScheduleModule.forRoot(), DbModule, WantedModule, ScorerModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
