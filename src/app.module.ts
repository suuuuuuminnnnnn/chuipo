import { Module } from '@nestjs/common';
import { DbModule } from './db/db.module';
import { BotModule } from './bot/bot.module';
import { SchedulerModule } from './scheduler/scheduler.module';

@Module({
  imports: [DbModule, BotModule, SchedulerModule],
})
export class AppModule {}
