import { Module } from '@nestjs/common';
import { DbModule } from '../../db/db.module';
import { WantedModule } from '../../wanted/wanted.module';
import { ScorerModule } from '../../scorer/scorer.module';
import { CommandsService } from './commands.service';
import { SetupCommand } from './setup.command';
import { SetRoleCommand } from './set-role.command';
import { SetKeywordsCommand } from './set-keywords.command';
import { SetLocationCommand } from './set-location.command';
import { SetExpCommand } from './set-exp.command';
import { MySettingsCommand } from './my-settings.command';
import { ScanAppliedCommand } from './scan-applied.command';
import { ScanJobsCommand } from './scan-jobs.command';
import { PauseCommand } from './pause.command';
import { ResumeCommand } from './resume.command';
import { LoginCommand } from './login.command';

@Module({
  imports: [DbModule, WantedModule, ScorerModule],
  providers: [
    CommandsService,
    SetupCommand, SetRoleCommand, SetKeywordsCommand, SetLocationCommand,
    SetExpCommand, MySettingsCommand, ScanAppliedCommand, ScanJobsCommand,
    PauseCommand, ResumeCommand, LoginCommand,
  ],
  exports: [CommandsService],
})
export class CommandsModule {}
