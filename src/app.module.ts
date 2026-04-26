import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DbModule } from './db/db.module';
import { BotModule } from './bot/bot.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { User } from './db/entities/user.entity';
import { AppliedJob } from './db/entities/applied-job.entity';
import { CollectedJob } from './db/entities/collected-job.entity';
import { BaselineSchema1745718000001 } from './db/migrations/1745718000001-BaselineSchema';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: 'chuipo.db',
      entities: [User, AppliedJob, CollectedJob],
      migrations: [BaselineSchema1745718000001],
      migrationsTableName: 'typeorm_migrations',
      migrationsRun: true,
      synchronize: false,
      logging: false,
    }),
    DbModule,
    BotModule,
    SchedulerModule,
  ],
})
export class AppModule {}
