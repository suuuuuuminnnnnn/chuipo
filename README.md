# 취뽀 (Chuipo)

Wanted 채용 플랫폼 연동 Discord 봇. 지원 현황을 자동으로 추적하고, 새 공고를 수집·점수화하여 Discord 웹훅으로 알림을 보낸다.

## 기능

- **지원 현황 추적**: Wanted 지원 목록을 주기적으로 스크래핑, 상태 변경 시 Discord 알림
- **공고 수집 & 점수화**: 기술 키워드 기반으로 공고를 `추천` / `검토` / `제외`로 분류
- **사용자별 설정**: `!` 접두사 한글 명령어로 역할, 기술 스택, 위치, 경력 등 개인 설정
- **크론 자동화**: 지원 현황 30분, 공고 수집 2시간 주기 (환경변수로 변경 가능)

## 스택

- **프레임워크**: NestJS 11 + @nestjs/schedule
- **Discord**: discord.js v14
- **DB**: better-sqlite3 (WAL 모드)
- **스크래핑**: Playwright (지원 현황), fetch API (공고 목록/상세)

## 환경변수

```bash
cp .env.example .env
```

| 변수 | 필수 | 설명 |
|------|------|------|
| `DISCORD_TOKEN` | ✅ | Discord 봇 토큰 |
| `DISCORD_CLIENT_ID` | ✅ | Discord 애플리케이션 ID |
| `OWNER_DISCORD_ID` | ✅ | 지원 현황 크론 추적 대상 Discord ID |
| `ALERT_CHANNEL_ID` | ✅ | 알림을 받을 Discord 채널 ID |
| `WANTED_EMAIL` | 선택 | Wanted 계정 이메일 (`!로그인` 대신 자동 로그인용) |
| `WANTED_PASSWORD` | 선택 | Wanted 계정 비밀번호 |
| `CRON_APPLIED_SCHEDULE` | 선택 | 지원 현황 크론 스케줄 (기본: `*/10 * * * *`) |
| `CRON_JOBS_SCHEDULE` | 선택 | 공고 수집 크론 스케줄 (기본: `0 */2 * * *`) |
| `SCORE_THRESHOLD_HIGH` | 선택 | 백엔드 분류 임계값 (기본: `5`) |
| `SCORE_THRESHOLD_LOW` | 선택 | 거절 분류 임계값 (기본: `-2`) |

## 설치

```bash
npm install
npx playwright install chromium
```

## Wanted 로그인

지원 현황 추적을 위해 최초 1회 (또는 세션 만료 시) 실행.

**로컬 (GUI 환경)**:
```bash
npm run wanted:login
# 브라우저가 열리면 직접 로그인 (2FA 포함)
```

**서버 (Ubuntu CLI 환경)** — `.env`에 `WANTED_EMAIL`, `WANTED_PASSWORD` 설정 후:
```bash
npm run wanted:login
# headless 모드로 자동 로그인
```

로그인 성공 시 `.wanted-session/state.json`에 세션 저장.

## 슬래시 커맨드 등록 (최초 1회)

```bash
npm run register-commands
```

## 실행

```bash
# 개발
npm run dev

# 프로덕션
npm run build && npm start
```

## 명령어

### `!` 접두사 명령어 (권장)

> Discord Dev Portal → Bot → **Message Content Intent** 활성화 필요

| 명령어 | 설명 |
|--------|------|
| `!명령어` | 명령어 목록 확인 |
| `!설정 [직군] [기술스택] [위치] [경력]` | 초기 설정 |
| `!내설정` | 현재 설정 확인 |
| `!지원현황` | 지원 상태 변경 즉시 조회 |
| `!공고조회` | 공고 수집 & 점수화 |
| `!알림정지` | 자동 알림 일시정지 |
| `!알림재개` | 자동 알림 재개 |
| `!로그인 이메일 비밀번호` | Wanted 세션 저장 (DM 권장) |

**설정 예시:**
```
!설정 backend kotlin,spring 서울 3
```
- 직군: `backend` / `frontend` / `fullstack` / `devops` / `data`
- 기술스택: 하나도 없으면 공고 제외 (쉼표로 구분)
- 경력: 숫자 (0 = 신입)

### 슬래시 커맨드

| 커맨드 | 설명 |
|--------|------|
| `/setup` | 초기 설정 |
| `/set-role` | 희망 직군 변경 |
| `/set-keywords` | 포함/제외 키워드 변경 |
| `/set-location` | 희망 근무지 변경 |
| `/set-exp` | 경력 연수 변경 |
| `/my-settings` | 현재 설정 조회 |
| `/scan-applied` | 지원 현황 즉시 조회 |
| `/scan-jobs` | 공고 즉시 수집 & 점수화 |
| `/pause` | 자동 알림 일시정지 |
| `/resume` | 자동 알림 재개 |

## 공고 점수화

본문(`main_tasks`, `requirements`, `preferred`) + `skill_tags` 기반으로 점수 계산.

- **백엔드 키워드** (Node, Spring, Django, Go, PostgreSQL, Redis, Docker 등) → `+1~3점`
- **프론트엔드 키워드** (React, Vue, CSS, Figma 등) → `-1~3점`
- ASCII 키워드는 단어 경계(`\b`) 매칭, 한국어 키워드는 부분 일치

| 총점 | 분류 |
|------|------|
| ≥ `SCORE_THRESHOLD_HIGH` (기본 5) | `BACKEND` (추천) |
| `SCORE_THRESHOLD_LOW` ~ `SCORE_THRESHOLD_HIGH`-1 | `REVIEW` (검토) |
| < `SCORE_THRESHOLD_LOW` (기본 -2) | `REJECT` (필터링) |

점수 규칙은 `src/config/scoring.ts`에서 수정 가능.

## 프로젝트 구조

```
src/
├── main.ts                    # 진입점
├── app.module.ts              # 루트 모듈
├── register.ts                # 슬래시 커맨드 등록 스크립트
├── bot/
│   ├── bot.service.ts         # Discord 클라이언트, 이벤트 핸들링
│   └── commands/              # 슬래시 커맨드 핸들러 (10개)
├── config/
│   ├── scoring.ts             # 점수 규칙 (키워드 가중치, 임계값)
│   └── status-colors.ts       # Discord 임베드 상태별 색상
├── db/                        # SQLite (better-sqlite3)
├── wanted/
│   ├── login.ts               # 로그인 스크립트
│   ├── session.service.ts     # 세션 관리
│   ├── applied.service.ts     # 지원 현황 스크래핑
│   └── jobs.service.ts        # 공고 수집 (fetch API)
├── scorer/                    # 점수 계산 엔진
└── scheduler/                 # 크론잡
```
