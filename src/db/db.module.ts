import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DbService } from './db.service';
import { User } from './entities/user.entity';
import { AppliedJob } from './entities/applied-job.entity';
import { CollectedJob } from './entities/collected-job.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, AppliedJob, CollectedJob])],
  providers: [DbService],
  exports: [DbService],
})
export class DbModule {}
