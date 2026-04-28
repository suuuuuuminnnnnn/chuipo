import 'dotenv/config';
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const SESSION_DIR = path.resolve('.wanted-session');
const STATE_FILE = path.join(SESSION_DIR, 'state.json');
const STOMP_PARAMS_FILE = path.join(SESSION_DIR, 'stomp-params.json');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function cookieHeader(stateFile: string): string {
  const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
  return (state.cookies as any[])
    .filter((c) => c.domain.endsWith('wanted.co.kr'))
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
}

async function captureStompParams(stateFile: string): Promise<void> {
  console.log('STOMP 파라미터 캡처 중...');

  const cookie = cookieHeader(stateFile);
  const headers = { Cookie: cookie, 'User-Agent': UA, Accept: 'application/json', Referer: 'https://www.wanted.co.kr/' };

  // user_hash: /api/v1/me에서 직접 조회
  const meRes = await fetch('https://www.wanted.co.kr/api/v1/me', { headers });
  if (!meRes.ok) {
    console.warn(`STOMP 캡처 실패: /api/v1/me → ${meRes.status}`);
    return;
  }
  const me = await meRes.json();
  const userHash: string = me?.user_hash;
  if (!userHash) {
    console.warn('STOMP 캡처 실패: user_hash 없음');
    return;
  }
  const destination = `/topic/wpoint.${userHash}`;

  // passcode: 기존 캐시 있으면 재사용, 없으면 JS 번들에서 추출
  let passcode = '';
  if (fs.existsSync(STOMP_PARAMS_FILE)) {
    try {
      const cached = JSON.parse(fs.readFileSync(STOMP_PARAMS_FILE, 'utf-8'));
      if (cached?.passcode) {
        passcode = cached.passcode;
        console.log('STOMP passcode: 캐시 재사용');
      }
    } catch {}
  }

  if (!passcode) {
    passcode = await extractPasscodeFromBundle() ?? '';
  }

  if (!passcode) {
    console.warn('STOMP passcode 추출 실패. stomp-params.json 없이 진행됨 (실시간 알림 비활성화)');
    return;
  }

  fs.writeFileSync(STOMP_PARAMS_FILE, JSON.stringify({ passcode, destination }, null, 2));
  console.log(`STOMP 파라미터 저장 완료: ${STOMP_PARAMS_FILE}`);
}

async function extractPasscodeFromBundle(): Promise<string | null> {
  console.log('JS 번들에서 STOMP passcode 추출 중...');
  try {
    const mainRes = await fetch('https://www.wanted.co.kr/', {
      headers: { 'User-Agent': UA, Accept: 'text/html' },
    });
    const html = await mainRes.text();

    // Next.js 청크 URL 수집
    const chunkUrls = new Set<string>();
    for (const m of html.matchAll(/\/_next\/static\/chunks\/[^"'\s]+\.js/g)) {
      chunkUrls.add(`https://www.wanted.co.kr${m[0]}`);
    }

    for (const url of chunkUrls) {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!res.ok) continue;
      const js = await res.text();

      // 패턴: passcode:"...", passcode:'...', passcode값 추출
      const m = js.match(/passcode[`'"]\s*[,:]\s*[`'"]([A-Za-z0-9+/=]{20,60})[`'"]/);
      if (m) {
        console.log('STOMP passcode JS 번들에서 발견');
        return m[1];
      }
    }
  } catch (err) {
    console.error('JS 번들 fetch 실패:', err);
  }
  return null;
}

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

  await captureStompParams(STATE_FILE);
}

login().catch((err) => {
  console.error('로그인 실패:', err.message);
  process.exit(1);
});
