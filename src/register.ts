import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder, SlashCommandOptionsOnlyBuilder } from 'discord.js';

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;

if (!token || !clientId) {
  console.error('.env에 DISCORD_TOKEN, DISCORD_CLIENT_ID를 설정해주세요.');
  process.exit(1);
}

const commands: (SlashCommandBuilder | SlashCommandOptionsOnlyBuilder)[] = [
  new SlashCommandBuilder()
    .setName('setup')
    .setDescription('초기 설정을 진행합니다')
    .addStringOption((o) =>
      o.setName('role').setDescription('희망 직군').setRequired(true).addChoices(
        { name: 'Backend', value: 'backend' },
        { name: 'Frontend', value: 'frontend' },
        { name: 'Fullstack', value: 'fullstack' },
        { name: 'DevOps', value: 'devops' },
        { name: 'Data', value: 'data' },
      ),
    )
    .addStringOption((o) => o.setName('tech_stack').setDescription('선호 기술 스택 - 없으면 제외 (예: node.js,nestjs,typescript)'))
    .addStringOption((o) => o.setName('include_keywords').setDescription('포함 시 점수 보너스 키워드 (쉼표 구분)'))
    .addStringOption((o) => o.setName('exclude_keywords').setDescription('포함 시 무조건 제외 키워드 (쉼표 구분)'))
    .addStringOption((o) => o.setName('location').setDescription('희망 근무지'))
    .addIntegerOption((o) => o.setName('exp').setDescription('경력 연수 (0=신입)').setMinValue(0).setMaxValue(20)),

  new SlashCommandBuilder()
    .setName('set-role').setDescription('희망 직군을 변경합니다')
    .addStringOption((o) =>
      o.setName('role').setDescription('희망 직군').setRequired(true).addChoices(
        { name: 'Backend', value: 'backend' },
        { name: 'Frontend', value: 'frontend' },
        { name: 'Fullstack', value: 'fullstack' },
        { name: 'DevOps', value: 'devops' },
        { name: 'Data', value: 'data' },
      ),
    ),

  new SlashCommandBuilder()
    .setName('set-keywords').setDescription('포함/제외 키워드를 변경합니다')
    .addStringOption((o) => o.setName('include').setDescription('포함할 키워드'))
    .addStringOption((o) => o.setName('exclude').setDescription('제외할 키워드')),

  new SlashCommandBuilder()
    .setName('set-location').setDescription('희망 근무지를 변경합니다')
    .addStringOption((o) => o.setName('location').setDescription('희망 근무지').setRequired(true)),

  new SlashCommandBuilder()
    .setName('set-exp').setDescription('경력 연수를 변경합니다')
    .addIntegerOption((o) =>
      o.setName('years').setDescription('경력 연수 (0=신입)').setMinValue(0).setMaxValue(20).setRequired(true),
    ),

  new SlashCommandBuilder().setName('my-settings').setDescription('내 설정을 확인합니다'),
  new SlashCommandBuilder().setName('scan-applied').setDescription('지원 현황을 즉시 조회합니다'),
  new SlashCommandBuilder().setName('scan-jobs').setDescription('새 공고를 수집하고 점수화합니다'),
  new SlashCommandBuilder().setName('pause').setDescription('알림을 일시정지합니다'),
  new SlashCommandBuilder().setName('resume').setDescription('알림을 재개합니다'),

  new SlashCommandBuilder()
    .setName('login')
    .setDescription('Wanted 로그인 (세션 저장)')
    .addStringOption((o) => o.setName('email').setDescription('Wanted 이메일').setRequired(true))
    .addStringOption((o) => o.setName('password').setDescription('Wanted 비밀번호').setRequired(true)),
];

const rest = new REST({ version: '10' }).setToken(token);

async function register() {
  console.log(`${commands.length}개의 슬래시 커맨드를 등록합니다...`);
  await rest.put(Routes.applicationCommands(clientId!), {
    body: commands.map((c) => c.toJSON()),
  });
  console.log('슬래시 커맨드 등록 완료!');
}

register().catch((err) => {
  console.error('커맨드 등록 실패:', err);
  process.exit(1);
});
