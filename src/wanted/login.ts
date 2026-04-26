import 'dotenv/config';
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const SESSION_DIR = path.resolve('.wanted-session');
const STATE_FILE = path.join(SESSION_DIR, 'state.json');

async function login() {
  const email = process.env.WANTED_EMAIL;
  const password = process.env.WANTED_PASSWORD;
  const headless = !!(email && password);

  if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('Wanted 로그인 페이지로 이동 중...');
  await page.goto('https://id.wanted.co.kr/login');
  await page.waitForLoadState('networkidle');

  if (email && password) {
    console.log('자격증명으로 자동 로그인 시도 중...');
    try {
      await page.fill('input[type="email"], input[name="email"]', email);
      await page.fill('input[type="password"], input[name="password"]', password);
      await page.click('button[type="submit"]');
    } catch {
      console.error('자동 입력 실패. WANTED_EMAIL/WANTED_PASSWORD를 확인해주세요.');
      await browser.close();
      process.exit(1);
    }
  } else {
    console.log('브라우저에서 직접 로그인해주세요. (2FA 포함)');
  }

  console.log('로그인 완료 대기 중...');
  try {
    await page.waitForURL('**/wanted.co.kr/**', { timeout: 120_000 });
  } catch {
    if (!page.url().includes('wanted.co.kr')) {
      console.error('로그인 실패. 다시 시도해주세요.');
      await browser.close();
      process.exit(1);
    }
  }

  await context.storageState({ path: STATE_FILE });
  console.log(`세션 저장 완료: ${STATE_FILE}`);
  await browser.close();
}

login().catch((err) => {
  console.error('로그인 실패:', err.message);
  process.exit(1);
});
