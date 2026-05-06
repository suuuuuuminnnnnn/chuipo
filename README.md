# 취뽀 (Chuipo)

Wanted 채용 플랫폼 연동 Discord 봇. 지원 현황을 자동으로 추적하고, 새 공고를 수집·점수화하여 Discord로 알림을 보낸다.

## 기능

- **지원 현황 추적**: Wanted 지원 목록을 주기적으로 폴링, 상태 변경 시 Discord 알림
- **실시간 알림**: Wanted WebSocket(STOMP)으로 이력서 열람 등 즉시 알림
- **공고 수집 & 점수화**: 기술 키워드 기반으로 공고를 `추천` / `검토` / `제외`로 분류
- **사용자별 설정**: 역할, 기술 스택, 위치, 경력 범위, 포함/제외 키워드 개인 설정
- **조용한 시간대**: 21:00~08:00 KST 크론 중단, 10~30분 랜덤 간격으로 봇 탐지 회피

## 스택

- **프레임워크**: NestJS 11 + TypeORM (better-sqlite3)
- **Discord**: discord.js v14
- **스크래핑**: Playwright (로그인 전용), fetch API (지원 현황·공고 수집)
- **실시간**: WebSocket STOMP (`wss://rtws.wanted.co.kr/ws`)

## 환경변수

```bash
cp .env.example .env
```

| 변수 | 필수 | 설명 |
|------|------|------|
| `DISCORD_TOKEN` | ✅ | Discord 봇 토큰 |
| `DISCORD_CLIENT_ID` | ✅ | Discord 애플리케이션 ID |
| `OWNER_DISCORD_ID` | ✅ | 지원 현황 추적 대상 Discord ID |
| `ALERT_CHANNEL_ID` | ✅ | 알림을 받을 Discord 채널 ID |
| `WANTED_EMAIL` | 선택 | Wanted 이메일 (headless 자동 로그인) |
| `WANTED_PASSWORD` | 선택 | Wanted 비밀번호 |
| `CRON_JOBS_SCHEDULE` | 선택 | 공고 수집 크론 (기본: `0 */2 * * *`) |
| `SCORE_THRESHOLD_HIGH` | 선택 | 추천 임계값 (기본: `11`) |
| `SCORE_THRESHOLD_LOW` | 선택 | 제외 임계값 (기본: `-2`) |

## 설치

```bash
npm install
npx playwright install chromium --with-deps
```

## Wanted 로그인

지원 현황 추적을 위해 최초 1회 (또는 세션 만료 시) 실행.

```bash
npm run wanted:login
# WANTED_EMAIL/PASSWORD 없으면 브라우저 창에서 직접 로그인 (2FA 포함)
```

로그인 완료 시 `.wanted-session/` 아래 두 파일 생성:
- `state.json` — 세션 쿠키
- `stomp-params.json` — 실시간 알림용 STOMP 자격증명

**WSL·서버 환경**: GUI 없이 headless 로그인 시 `WANTED_EMAIL`, `WANTED_PASSWORD`를 `.env`에 설정. 로그인 후 `stomp-params.json`이 자동으로 생성된다. 만약 STOMP 캡처가 실패하면 GUI 환경에서 로그인한 `.wanted-session/` 폴더를 통째로 복사하면 된다.

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

### 슬래시 커맨드

| 커맨드 | 설명 |
|--------|------|
| `/setup` | 초기 설정 (기존 설정 미리 채워진 모달) |
| `/set-role` | 희망 직군 변경 |
| `/set-keywords` | 포함/제외 키워드 변경 |
| `/set-location` | 희망 근무지 변경 |
| `/set-exp` | 경력 범위 변경 |
| `/my-settings` | 현재 설정 조회 |
| `/scan-applied` | 지원 현황 즉시 조회 |
| `/scan-jobs` | 공고 즉시 수집 & 점수화 |
| `/pause` | 자동 알림 일시정지 |
| `/resume` | 자동 알림 재개 |

### `!` 접두사 명령어

> Discord Dev Portal → Bot → **Message Content Intent** 활성화 필요

| 명령어 | 설명 |
|--------|------|
| `!명령어` | 명령어 목록 |
| `!설정 [직군] [기술스택] [위치] [경력]` | 초기 설정 |
| `!내설정` | 설정 확인 |
| `!지원현황` | 지원 현황 즉시 조회 |
| `!공고조회` | 공고 수집 & 점수화 |
| `!알림정지` / `!알림재개` | 알림 토글 |
| `!로그인 이메일 비밀번호` | Wanted 세션 저장 (DM 권장) |

## 공고 점수화

본문(`main_tasks`, `requirements`, `preferred`) + `skill_tags` 기반으로 점수 계산. 제목이 "Software Engineer", "개발자" 등 중립 키워드면 제목은 점수 계산에서 제외.

- **백엔드 키워드** (Node, Spring, Django, Go, PostgreSQL, Redis, Docker, Kafka 등) → `+1~3점`
- **프론트엔드 키워드** (React, Vue, CSS, Figma, Webpack 등) → `-1~3점`

| 총점 | 분류 |
|------|------|
| ≥ `SCORE_THRESHOLD_HIGH` (기본 11) | `BACKEND` (추천) |
| `SCORE_THRESHOLD_LOW` ~ `SCORE_THRESHOLD_HIGH`-1 | `REVIEW` (검토) |
| ≤ `SCORE_THRESHOLD_LOW` (기본 -2) | `REJECT` (필터링) |

## 프로젝트 구조

```
src/
├── main.ts
├── app.module.ts
├── register.ts                # 슬래시 커맨드 등록
├── bot/
│   ├── bot.service.ts
│   ├── commands/              # 슬래시 커맨드 (10개)
│   └── prefix/                # ! 접두사 명령어
├── config/
│   ├── scoring.config.ts      # 키워드 가중치·임계값
│   └── status-colors.ts
├── db/
│   ├── entities/              # TypeORM 엔티티
│   ├── migrations/            # DB 마이그레이션
│   └── db.service.ts
├── wanted/
│   ├── login.ts               # 로그인 (Playwright)
│   ├── session.service.ts     # 세션 관리
│   ├── applied.service.ts     # 지원 현황 (HTTP fetch)
│   └── jobs.service.ts        # 공고 수집 (HTTP fetch)
├── scorer/                    # 점수 계산 엔진
└── scheduler/
    ├── scheduler.service.ts   # 크론잡
    └── realtime.service.ts    # WebSocket STOMP 실시간 알림
```
