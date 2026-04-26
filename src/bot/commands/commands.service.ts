import { Injectable, OnModuleInit } from '@nestjs/common';
import { ChatInputCommandInteraction, ModalSubmitInteraction } from 'discord.js';
import { BotCommand } from './base.command';
import { SetupCommand, SETUP_MODAL_ID } from './setup.command';
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

@Injectable()
export class CommandsService implements OnModuleInit {
  private readonly commandMap = new Map<string, BotCommand>();

  constructor(
    private readonly setup: SetupCommand,
    private readonly setRole: SetRoleCommand,
    private readonly setKeywords: SetKeywordsCommand,
    private readonly setLocation: SetLocationCommand,
    private readonly setExp: SetExpCommand,
    private readonly mySettings: MySettingsCommand,
    private readonly scanApplied: ScanAppliedCommand,
    private readonly scanJobs: ScanJobsCommand,
    private readonly pause: PauseCommand,
    private readonly resume: ResumeCommand,
    private readonly login: LoginCommand,
  ) {}

  onModuleInit() {
    const commands: BotCommand[] = [
      this.setup, this.setRole, this.setKeywords, this.setLocation,
      this.setExp, this.mySettings, this.scanApplied, this.scanJobs,
      this.pause, this.resume, this.login,
    ];
    for (const cmd of commands) {
      this.commandMap.set(cmd.data.name, cmd);
    }
  }

  async handle(interaction: ChatInputCommandInteraction): Promise<void> {
    const cmd = this.commandMap.get(interaction.commandName);
    if (cmd) await cmd.execute(interaction);
  }

  async handleModal(interaction: ModalSubmitInteraction): Promise<void> {
    if (interaction.customId === SETUP_MODAL_ID) {
      await this.setup.handleModalSubmit(interaction);
    }
  }

  getAll(): BotCommand[] {
    return [...this.commandMap.values()];
  }
}
