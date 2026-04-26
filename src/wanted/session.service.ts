import { Injectable } from '@nestjs/common';
import { chromium, BrowserContext } from 'playwright';
import path from 'path';
import fs from 'fs';

export const SESSION_DIR = path.resolve('.wanted-session');
export const STATE_FILE = path.join(SESSION_DIR, 'state.json');

@Injectable()
export class SessionService {
  sessionExists(): boolean {
    return fs.existsSync(STATE_FILE);
  }

  async isSessionValid(context: BrowserContext): Promise<boolean> {
    const page = await context.newPage();
    try {
      const response = await page.goto('https://www.wanted.co.kr/api/v4/me', {
        waitUntil: 'domcontentloaded',
        timeout: 15_000,
      });
      if (!response) return false;
      if (page.url().includes('id.wanted.co.kr')) return false;
      return response.status() === 200;
    } catch {
      return false;
    } finally {
      await page.close();
    }
  }

  async login(email: string, password: string): Promise<void> {
    if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await page.goto('https://id.wanted.co.kr/login');
      await page.waitForLoadState('networkidle');
      await page.fill('input[type="email"], input[name="email"], input[autocomplete="email"], input[autocomplete="username"]', email);
      await page.fill('input[type="password"], input[name="password"], input[autocomplete="current-password"]', password);
      await page.click('button[type="submit"], button:has-text("로그인"), button:has-text("Login")');
      await page.waitForURL('**/wanted.co.kr/**', { timeout: 60_000 });
      await context.storageState({ path: STATE_FILE });
    } finally {
      await browser.close();
    }
  }

  async withSession<T>(fn: (context: BrowserContext) => Promise<T>): Promise<T> {
    if (!this.sessionExists()) throw new Error('SESSION_NOT_FOUND');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ storageState: STATE_FILE });
    try {
      const valid = await this.isSessionValid(context);
      if (!valid) throw new Error('SESSION_EXPIRED');
      return await fn(context);
    } finally {
      await browser.close();
    }
  }
}
