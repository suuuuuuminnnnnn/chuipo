# Chuipo

Wanted 채용 플랫폼 연동 Discord 봇. 지원 현황 추적, 공고 수집 및 점수 기반 분류를 자동화합니다.

## 주요 기능

- Wanted 로그인 세션 관리 (Playwright)
- 지원 현황 변경 시 Discord 멘션 알림
- 공고 수집 & 본문/기술스택 기반 점수화 (backend / review / reject)
- 사용자별 설정 관리 (SQLite)
- 슬래시 커맨드 10개

## 기술 스택

- Node.js + TypeScript
- discord.js v14
- Playwright
- better-sqlite3
- node-cron
- dotenv

## 설치

```bash
npm install
npx playwright install chromium
```

## 환경 변수

`.env.example`을 `.env`로 복사 후 값을 채워주세요.

```bash
cp .env.example .env
```

| 변수 | 설명 |
|------|------|
| `DISCORD_TOKEN` | Discord 봇 토큰 |
| `DISCORD_CLIENT_ID` | Discord 애플리케이션 ID |
| `WANTED_EMAIL` | Wanted 로그인 이메일 |
| `WANTED_PASSWORD` | Wanted 로그인 비밀번호 |
| `CRON_APPLIED_SCHEDULE` | 지원 현황 체크 주기 (기본: `*/30 * * * *`) |
| `CRON_JOBS_SCHEDULE` | 공고 수집 주기 (기본: `0 */2 * * *`) |
| `SCORE_THRESHOLD_HIGH` | backend 분류 점수 임계값 (기본: `5`) |
| `SCORE_THRESHOLD_LOW` | reject 분류 점수 임계값 (기본: `-2`) |

## 실행

### 1. Wanted 로그인 (최초 1회 / 세션 만료 시)

```bash
npm run wanted:login
```

브라우저가 열리면 로그인을 완료하세요. 2FA가 필요하면 직접 입력해주세요.

### 2. 슬래시 커맨드 등록 (최초 1회)

```bash
npm run register-commands
```

### 3. 봇 실행

```bash
# 개발
npm run dev

# 프로덕션
npm run build
npm start
```

## 슬래시 커맨드

| 커맨드 | 설명 |
|--------|------|
| `/setup` | 초기 설정 (역할, 키워드, 위치, 경력, 알림 채널) |
| `/set-role` | 희망 직군 변경 |
| `/set-keywords` | 포함/제외 키워드 변경 |
| `/set-location` | 희망 근무지 변경 |
| `/set-exp` | 경력 연수 변경 |
| `/my-settings` | 내 설정 확인 |
| `/scan-applied` | 지원 현황 즉시 조회 |
| `/scan-jobs` | 새 공고 수집 & 점수화 |
| `/pause` | 알림 일시정지 |
| `/resume` | 알림 재개 |

## 점수 시스템

- 제목만으로 판단하지 않음 (중립 제목은 본문 기반 판단)
- 백엔드 기술 키워드: +1~3점
- 프론트엔드 기술 키워드: -1~3점
- skill_tags 보너스: 백엔드 기술 태그당 +1점
- 점수 >= `SCORE_THRESHOLD_HIGH` -> **backend** (추천)
- 점수 <= `SCORE_THRESHOLD_LOW` -> **reject** (제외)
- 그 외 -> **review** (검토 필요)

점수 규칙은 `src/config/scoring.ts`에서 수정 가능합니다.

## 프로젝트 구조

```
src/
├── index.ts              # 진입점
├── bot.ts                # Discord 클라이언트
├── config/
│   └── scoring.ts        # 점수 규칙
├── commands/             # 슬래시 커맨드
├── db/
│   └── index.ts          # SQLite
├── wanted/
│   ├── login.ts          # 로그인 스크립트
│   ├── session.ts        # 세션 관리
│   ├── applied.ts        # 지원 현황
│   └── jobs.ts           # 공고 수집
├── scorer/
│   └── index.ts          # 점수 계산
└── cron/
    └── index.ts          # 크론잡
```
