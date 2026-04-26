import { Module } from '@nestjs/common';
import { SessionService } from './session.service';
import { JobsService } from './jobs.service';
import { AppliedService } from './applied.service';

@Module({
  providers: [SessionService, JobsService, AppliedService],
  exports: [SessionService, JobsService, AppliedService],
})
export class WantedModule {}
