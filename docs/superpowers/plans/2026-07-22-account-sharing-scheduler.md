# 인강 계정 공유 시간 관리 웹페이지 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 팀 5명이 인강 계정 점유 현황(체크인/체크아웃)과 주간 예약을 공유해 동시 접속 충돌을 막는 웹앱을 만든다.

**Architecture:** Next.js 15 App Router 단일 앱(Vercel 배포)이 프론트와 서버 로직을 모두 담당한다. Supabase Postgres에는 서버 코드만 접근하며(서비스 롤 키), 클라이언트는 5초 폴링으로 상태를 갱신한다. 진입은 팀 공용 비밀번호 게이트(HMAC 서명 쿠키) → 이름 선택 쿠키.

**Tech Stack:** Next.js 15 (App Router, TypeScript, Tailwind), @supabase/supabase-js, Vitest

**Spec:** `docs/superpowers/specs/2026-07-22-account-sharing-scheduler-design.md`

## Global Constraints

- 모든 DB 접근은 서버 코드에서만. 계정 비밀번호는 `/api/status` 응답에 절대 포함하지 않는다(별도 서버 액션으로만 조회).
- 자동 체크아웃: `planned_checkout_at`이 null(미정)이면 체크인 + **2시간** 후 해제. 스케줄러 없이 **읽을 때 계산**.
- 로그인 잠금: **5회** 연속 실패 → **60초** 잠금, 성공 시 기록 삭제.
- 시간표 슬롯: **09:00~24:00, 30분 단위** (하루 30슬롯), 주간(월~일).
- "당일" 판단은 **KST(UTC+9, DST 없음) 고정 오프셋**으로 서버에서 계산.
- 폴링 간격 **5초**.
- 팀원 5명 이름은 `lib/members.ts` 상수 배열(팀이 직접 수정).
- 환경 변수: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TEAM_PASSWORD`, `SESSION_SECRET` (하드코딩 금지).
- 쿠키: `team_session`(HMAC 서명 토큰, 30일), `member_name`(encodeURIComponent 인코딩 — 한글은 쿠키에 직접 못 넣음).
- 단위 테스트는 순수 로직만(`tests/*.test.ts`, Vitest). DB/UI는 수동 검증.
- Node 18.18+ (개발 머신은 Node 24).

## File Structure

```
app/
  layout.tsx                  # 수정: Nav 삽입
  page.tsx                    # 페이지1: 인강 목록 (서버 셸)
  login/page.tsx              # 공용 비밀번호 입력
  select-name/page.tsx        # 이름 선택
  schedule/page.tsx           # 페이지2: 시간표 (서버 셸)
  admin/page.tsx              # 관리 화면
  api/status/route.ts         # 폴링용 현황 API
  api/reservations/route.ts   # 주간 예약 조회 API
  actions/auth-actions.ts     # login, selectName
  actions/session-actions.ts  # checkIn, checkOut, getAccountCredentials
  actions/reservation-actions.ts # createReservation, cancelReservation
  actions/admin-actions.ts    # 계정/인강 CRUD
components/
  nav.tsx
  course-list.tsx             # 목록 + 필터 + 검색
  checkin-controls.tsx        # 체크인/체크아웃 버튼(카드·모달 공용)
  account-modal.tsx           # 계정 확인하기 모달
  schedule-grid.tsx           # 주간 예약표
lib/
  types.ts                    # 공유 타입
  supabase.ts                 # 서버 전용 Supabase 클라이언트
  availability.ts             # 사용 가능 여부 판단 (TDD)
  auth.ts                     # HMAC 세션 토큰 (TDD)
  rate-limit.ts               # 로그인 잠금 로직 (TDD)
  time.ts                     # KST 당일 범위 (TDD)
  slots.ts                    # 주간/슬롯 계산 (TDD)
  members.ts                  # 팀원 이름 5명
  member.ts                   # member_name 쿠키 읽기
  use-polling.ts              # 폴링 훅
middleware.ts                 # 인증 게이트
supabase/schema.sql           # 테이블 + 제약
supabase/seed.sql             # 검증용 샘플 데이터
tests/                        # Vitest 단위 테스트
.env.local.example
```

---

### Task 1: Next.js 스캐폴드 + Vitest 셋업

**Files:**
- Create: Next.js 프로젝트 전체(create-next-app), `vitest.config.ts`, `tests/smoke.test.ts`
- Modify: `package.json` (test 스크립트)

**Interfaces:**
- Produces: `@/` import alias(저장소 루트), `npm test`(Vitest), `npm run dev`, `npm run build`

주의: 저장소 루트에 이미 `README.md`, `docs/`, `.git`(워크트리라 **파일**임 — 건드리지 말 것)이 있어 create-next-app을 임시 폴더에 만들고 복사한다. README.md는 덮어써도 된다(내용이 `# goodProgram` 한 줄, 마지막 Task에서 재작성).

- [ ] **Step 1: 임시 폴더에 스캐폴드 생성 후 루트로 이동**

```bash
cd /Users/choi/orca/workspaces/goodProgram/rudd
npx create-next-app@latest tmp-app --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*" --turbopack --use-npm
rm -rf tmp-app/.git
rsync -a tmp-app/ ./
rm -rf tmp-app
```

프롬프트가 나오면 기본값으로 진행. Expected: 루트에 `app/`, `package.json`, `next.config.ts`, `tsconfig.json` 등 생성.

- [ ] **Step 2: 개발 서버 스모크 확인**

```bash
npm run dev
```

Expected: `http://localhost:3000` 에서 Next.js 기본 페이지가 뜬다. 확인 후 종료(Ctrl+C).

- [ ] **Step 3: Vitest 설치 및 설정**

```bash
npm install -D vitest
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: { include: ["tests/**/*.test.ts"] },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
});
```

`package.json`의 `"scripts"`에 추가:

```json
"test": "vitest run"
```

- [ ] **Step 4: 스모크 테스트 작성 및 실행**

Create `tests/smoke.test.ts`:

```ts
import { describe, it, expect } from "vitest";

describe("smoke", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run: `npm test`
Expected: `1 passed`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with Vitest"
```

---

### Task 2: DB 스키마 + Supabase 서버 클라이언트 + 환경 변수

**Files:**
- Create: `supabase/schema.sql`, `supabase/seed.sql`, `lib/supabase.ts`, `.env.local.example`, `.env.local`(gitignore됨)

**Interfaces:**
- Produces: `supabaseServer(): SupabaseClient` — 모든 서버 코드가 DB 접근에 사용. 테이블: `accounts`, `courses`, `reservations`(겹침 방지 exclusion 제약), `sessions`, `login_attempts`.

- [ ] **Step 1: 스키마 SQL 작성**

Create `supabase/schema.sql`:

```sql
create extension if not exists btree_gist;

create table accounts (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  site text not null,
  login_id text not null,
  login_password text not null,
  created_at timestamptz not null default now()
);

create table courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  account_id uuid not null references accounts(id) on delete cascade
);

create table reservations (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references courses(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  member_name text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint reservations_no_overlap exclude using gist (
    account_id with =,
    tstzrange(start_at, end_at) with &&
  )
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  member_name text not null,
  checked_in_at timestamptz not null default now(),
  planned_checkout_at timestamptz,
  checked_out_at timestamptz
);

create table login_attempts (
  ip text primary key,
  fail_count int not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);
```

- [ ] **Step 2: 검증용 시드 SQL 작성**

Create `supabase/seed.sql`:

```sql
insert into accounts (label, site, login_id, login_password) values
  ('계정1', 'inflearn.com', 'team-acc1@example.com', 'pw-account-1'),
  ('계정2', 'inflearn.com', 'team-acc2@example.com', 'pw-account-2');

insert into courses (title, category, account_id) values
  ('스프링 부트 입문', 'backend', (select id from accounts where label = '계정1')),
  ('리액트 완벽 가이드', 'frontend', (select id from accounts where label = '계정1')),
  ('리눅스 서버 운영', 'server', (select id from accounts where label = '계정2'));
```

- [ ] **Step 3: Supabase 프로젝트 준비 (수동 — 사용자 작업)**

사용자에게 요청: [supabase.com](https://supabase.com)에서 무료 프로젝트 생성 → SQL Editor에서 `schema.sql` 전체 실행 → 이어서 `seed.sql` 실행 → Settings > API 에서 Project URL과 `service_role` 키 확보.

Expected: SQL Editor에서 두 파일 모두 "Success" 로 실행됨.

- [ ] **Step 4: Supabase 클라이언트 및 환경 변수 파일**

```bash
npm install @supabase/supabase-js
```

Create `lib/supabase.ts`:

```ts
import { createClient } from "@supabase/supabase-js";

export function supabaseServer() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
```

Create `.env.local.example`:

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=
TEAM_PASSWORD=
SESSION_SECRET=
```

`.env.local`을 만들어 실제 값 입력(사용자에게 요청). `SESSION_SECRET`은 `openssl rand -hex 32`로 생성. `.env.local`이 `.gitignore`에 있는지 확인(create-next-app 기본 포함).

- [ ] **Step 5: 빌드 확인 및 Commit**

Run: `npm run build`
Expected: 빌드 성공.

```bash
git add supabase/ lib/supabase.ts .env.local.example package.json package-lock.json
git commit -m "feat: add DB schema, seed data, and Supabase server client"
```

---

### Task 3: 공유 타입 + 사용 가능 여부 판단 로직 (TDD)

**Files:**
- Create: `lib/types.ts`, `lib/availability.ts`
- Test: `tests/availability.test.ts`

**Interfaces:**
- Produces:
  - `lib/types.ts`: `Account`, `AccountWithCredentials`, `Course`, `Session`, `Reservation`, `AccountStatus`, `StatusPayload`
  - `AUTO_CHECKOUT_MS: number` (2시간)
  - `effectiveCheckoutAt(s: Pick<Session, "checked_in_at" | "planned_checkout_at">): Date`
  - `isSessionActive(s: Session, now: Date): boolean`
  - `findActiveSession(sessions: Session[], accountId: string, now: Date): Session | null`

- [ ] **Step 1: 타입 정의**

Create `lib/types.ts`:

```ts
export type Account = {
  id: string;
  label: string;
  site: string;
};

export type AccountWithCredentials = Account & {
  login_id: string;
  login_password: string;
};

export type Course = {
  id: string;
  title: string;
  category: string;
  account_id: string;
};

export type Session = {
  id: string;
  account_id: string;
  member_name: string;
  checked_in_at: string;
  planned_checkout_at: string | null;
  checked_out_at: string | null;
};

export type Reservation = {
  id: string;
  course_id: string | null;
  account_id: string;
  member_name: string;
  start_at: string;
  end_at: string;
};

export type AccountStatus = Account & {
  activeSession: {
    id: string;
    member_name: string;
    effective_checkout_at: string;
  } | null;
};

export type StatusPayload = {
  accounts: AccountStatus[];
  courses: Course[];
  todayReservations: Reservation[];
};
```

- [ ] **Step 2: 실패하는 테스트 작성**

Create `tests/availability.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  AUTO_CHECKOUT_MS,
  effectiveCheckoutAt,
  isSessionActive,
  findActiveSession,
} from "@/lib/availability";
import type { Session } from "@/lib/types";

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "s1",
    account_id: "a1",
    member_name: "철수",
    checked_in_at: "2026-07-22T10:00:00.000Z",
    planned_checkout_at: null,
    checked_out_at: null,
    ...overrides,
  };
}

describe("effectiveCheckoutAt", () => {
  it("planned_checkout_at이 있으면 그 시각", () => {
    const s = makeSession({ planned_checkout_at: "2026-07-22T11:00:00.000Z" });
    expect(effectiveCheckoutAt(s).toISOString()).toBe("2026-07-22T11:00:00.000Z");
  });

  it("미정이면 체크인 + 2시간", () => {
    const s = makeSession();
    expect(effectiveCheckoutAt(s).getTime()).toBe(
      new Date("2026-07-22T10:00:00.000Z").getTime() + AUTO_CHECKOUT_MS,
    );
  });
});

describe("isSessionActive", () => {
  it("체크아웃했으면 비활성", () => {
    const s = makeSession({ checked_out_at: "2026-07-22T10:30:00.000Z" });
    expect(isSessionActive(s, new Date("2026-07-22T10:40:00.000Z"))).toBe(false);
  });

  it("예정 해제 시각 전이면 활성", () => {
    const s = makeSession({ planned_checkout_at: "2026-07-22T11:00:00.000Z" });
    expect(isSessionActive(s, new Date("2026-07-22T10:59:59.000Z"))).toBe(true);
  });

  it("예정 해제 시각이 지나면 비활성", () => {
    const s = makeSession({ planned_checkout_at: "2026-07-22T11:00:00.000Z" });
    expect(isSessionActive(s, new Date("2026-07-22T11:00:00.000Z"))).toBe(false);
  });

  it("미정 세션은 2시간 후 자동 비활성", () => {
    const s = makeSession();
    expect(isSessionActive(s, new Date("2026-07-22T11:59:59.000Z"))).toBe(true);
    expect(isSessionActive(s, new Date("2026-07-22T12:00:00.000Z"))).toBe(false);
  });
});

describe("findActiveSession", () => {
  it("해당 계정의 활성 세션만 찾는다", () => {
    const active = makeSession({ id: "s2", account_id: "a2" });
    const sessions = [
      makeSession({ checked_out_at: "2026-07-22T10:10:00.000Z" }),
      active,
    ];
    const now = new Date("2026-07-22T10:30:00.000Z");
    expect(findActiveSession(sessions, "a2", now)).toBe(active);
    expect(findActiveSession(sessions, "a1", now)).toBeNull();
  });
});
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `npm test`
Expected: FAIL — `Cannot find module '@/lib/availability'` 류의 오류.

- [ ] **Step 4: 구현**

Create `lib/availability.ts`:

```ts
import type { Session } from "./types";

export const AUTO_CHECKOUT_MS = 2 * 60 * 60 * 1000;

export function effectiveCheckoutAt(
  s: Pick<Session, "checked_in_at" | "planned_checkout_at">,
): Date {
  if (s.planned_checkout_at) return new Date(s.planned_checkout_at);
  return new Date(new Date(s.checked_in_at).getTime() + AUTO_CHECKOUT_MS);
}

export function isSessionActive(s: Session, now: Date): boolean {
  if (s.checked_out_at) return false;
  return now < effectiveCheckoutAt(s);
}

export function findActiveSession(
  sessions: Session[],
  accountId: string,
  now: Date,
): Session | null {
  return (
    sessions.find((s) => s.account_id === accountId && isSessionActive(s, now)) ??
    null
  );
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm test`
Expected: 전부 PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts lib/availability.ts tests/availability.test.ts
git commit -m "feat: add availability logic with 2h auto checkout"
```

---

### Task 4: HMAC 세션 토큰 (TDD)

**Files:**
- Create: `lib/auth.ts`
- Test: `tests/auth.test.ts`

**Interfaces:**
- Produces:
  - `SESSION_TTL_MS: number` (30일)
  - `createSessionToken(secret: string, now: Date): Promise<string>` — `"만료ms.서명hex"` 형태
  - `verifySessionToken(token: string, secret: string, now: Date): Promise<boolean>`
- Edge 미들웨어에서 돌아야 하므로 **Web Crypto API만** 사용(Node `crypto`/`Buffer` 금지).

- [ ] **Step 1: 실패하는 테스트 작성**

Create `tests/auth.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createSessionToken, verifySessionToken, SESSION_TTL_MS } from "@/lib/auth";

const SECRET = "test-secret";
const NOW = new Date("2026-07-22T10:00:00.000Z");

describe("session token", () => {
  it("생성한 토큰은 검증을 통과한다", async () => {
    const token = await createSessionToken(SECRET, NOW);
    expect(await verifySessionToken(token, SECRET, NOW)).toBe(true);
  });

  it("다른 시크릿으로는 실패한다", async () => {
    const token = await createSessionToken(SECRET, NOW);
    expect(await verifySessionToken(token, "wrong", NOW)).toBe(false);
  });

  it("만료되면 실패한다", async () => {
    const token = await createSessionToken(SECRET, NOW);
    const after = new Date(NOW.getTime() + SESSION_TTL_MS);
    expect(await verifySessionToken(token, SECRET, after)).toBe(false);
  });

  it("변조된 토큰은 실패한다", async () => {
    const token = await createSessionToken(SECRET, NOW);
    const [exp, sig] = token.split(".");
    const forged = `${Number(exp) + 9999999}.${sig}`;
    expect(await verifySessionToken(forged, SECRET, NOW)).toBe(false);
    expect(await verifySessionToken("garbage", SECRET, NOW)).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test`
Expected: FAIL — `Cannot find module '@/lib/auth'`.

- [ ] **Step 3: 구현**

Create `lib/auth.ts`:

```ts
const encoder = new TextEncoder();

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

async function hmacHex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createSessionToken(secret: string, now: Date): Promise<string> {
  const exp = now.getTime() + SESSION_TTL_MS;
  return `${exp}.${await hmacHex(secret, String(exp))}`;
}

export async function verifySessionToken(
  token: string,
  secret: string,
  now: Date,
): Promise<boolean> {
  const [expStr, sig] = token.split(".");
  if (!expStr || !sig) return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || now.getTime() >= exp) return false;
  return sig === (await hmacHex(secret, expStr));
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test`
Expected: 전부 PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/auth.ts tests/auth.test.ts
git commit -m "feat: add HMAC session token (edge-compatible)"
```

---

### Task 5: 로그인 잠금 로직 (TDD)

**Files:**
- Create: `lib/rate-limit.ts`
- Test: `tests/rate-limit.test.ts`

**Interfaces:**
- Produces:
  - `MAX_FAILS = 5`, `LOCK_MS = 60_000`
  - `type AttemptState = { fail_count: number; locked_until: string | null }`
  - `isLocked(state: AttemptState | null, now: Date): boolean`
  - `nextStateOnFailure(state: AttemptState | null, now: Date): AttemptState` — 5번째 실패에서 `locked_until = now + 60초`, `fail_count`는 0으로 리셋(잠금 해제 후 새로 카운트)

- [ ] **Step 1: 실패하는 테스트 작성**

Create `tests/rate-limit.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isLocked, nextStateOnFailure, MAX_FAILS, LOCK_MS } from "@/lib/rate-limit";

const NOW = new Date("2026-07-22T10:00:00.000Z");

describe("isLocked", () => {
  it("기록 없으면 잠기지 않음", () => {
    expect(isLocked(null, NOW)).toBe(false);
  });

  it("locked_until이 미래면 잠김", () => {
    const state = { fail_count: 0, locked_until: "2026-07-22T10:00:30.000Z" };
    expect(isLocked(state, NOW)).toBe(true);
  });

  it("locked_until이 지났으면 풀림", () => {
    const state = { fail_count: 0, locked_until: "2026-07-22T09:59:59.000Z" };
    expect(isLocked(state, NOW)).toBe(false);
  });
});

describe("nextStateOnFailure", () => {
  it("실패마다 카운트 증가", () => {
    expect(nextStateOnFailure(null, NOW)).toEqual({ fail_count: 1, locked_until: null });
    expect(nextStateOnFailure({ fail_count: 3, locked_until: null }, NOW)).toEqual({
      fail_count: 4,
      locked_until: null,
    });
  });

  it("5번째 실패에서 60초 잠금 + 카운트 리셋", () => {
    const next = nextStateOnFailure({ fail_count: MAX_FAILS - 1, locked_until: null }, NOW);
    expect(next.fail_count).toBe(0);
    expect(next.locked_until).toBe(new Date(NOW.getTime() + LOCK_MS).toISOString());
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test`
Expected: FAIL — `Cannot find module '@/lib/rate-limit'`.

- [ ] **Step 3: 구현**

Create `lib/rate-limit.ts`:

```ts
export const MAX_FAILS = 5;
export const LOCK_MS = 60_000;

export type AttemptState = {
  fail_count: number;
  locked_until: string | null;
};

export function isLocked(state: AttemptState | null, now: Date): boolean {
  return !!state?.locked_until && now < new Date(state.locked_until);
}

export function nextStateOnFailure(
  state: AttemptState | null,
  now: Date,
): AttemptState {
  const count = (state?.fail_count ?? 0) + 1;
  if (count >= MAX_FAILS) {
    return {
      fail_count: 0,
      locked_until: new Date(now.getTime() + LOCK_MS).toISOString(),
    };
  }
  return { fail_count: count, locked_until: null };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test`
Expected: 전부 PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/rate-limit.ts tests/rate-limit.test.ts
git commit -m "feat: add login rate limit logic (5 fails -> 60s lock)"
```

---

### Task 6: KST 당일 범위 계산 (TDD)

**Files:**
- Create: `lib/time.ts`
- Test: `tests/time.test.ts`

**Interfaces:**
- Produces: `kstDayRange(now: Date): { start: Date; end: Date }` — `now`가 속한 KST 달력일의 UTC 경계. 서버(Vercel=UTC)에서 "당일 예약" 필터에 사용.

- [ ] **Step 1: 실패하는 테스트 작성**

Create `tests/time.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { kstDayRange } from "@/lib/time";

describe("kstDayRange", () => {
  it("KST 낮 시간대", () => {
    // UTC 10:00 = KST 19:00 (7/22)
    const { start, end } = kstDayRange(new Date("2026-07-22T10:00:00.000Z"));
    expect(start.toISOString()).toBe("2026-07-21T15:00:00.000Z"); // KST 7/22 00:00
    expect(end.toISOString()).toBe("2026-07-22T15:00:00.000Z"); // KST 7/23 00:00
  });

  it("UTC 기준 날짜와 KST 날짜가 다른 새벽", () => {
    // UTC 20:00 (7/22) = KST 05:00 (7/23)
    const { start, end } = kstDayRange(new Date("2026-07-22T20:00:00.000Z"));
    expect(start.toISOString()).toBe("2026-07-22T15:00:00.000Z"); // KST 7/23 00:00
    expect(end.toISOString()).toBe("2026-07-23T15:00:00.000Z");
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test`
Expected: FAIL — `Cannot find module '@/lib/time'`.

- [ ] **Step 3: 구현**

Create `lib/time.ts`:

```ts
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function kstDayRange(now: Date): { start: Date; end: Date } {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  const start = new Date(
    Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) -
      KST_OFFSET_MS,
  );
  return { start, end: new Date(start.getTime() + DAY_MS) };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test`
Expected: 전부 PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/time.ts tests/time.test.ts
git commit -m "feat: add KST day range helper"
```

---

### Task 7: 공용 비밀번호 로그인 + 미들웨어

**Files:**
- Create: `app/actions/auth-actions.ts`(login만, selectName은 Task 8), `app/login/page.tsx`, `middleware.ts`

**Interfaces:**
- Consumes: `supabaseServer()`, `createSessionToken`/`verifySessionToken`, `isLocked`/`nextStateOnFailure`
- Produces:
  - `login(prev: { error: string } | null, formData: FormData): Promise<{ error: string }>` — 성공 시 `team_session` 쿠키 설정 후 `/select-name`으로 redirect(반환 안 함)
  - `middleware.ts` — `/login` 외 전 경로에서 `team_session` 검증, 실패 시 `/login`으로. `member_name` 쿠키 없으면 `/select-name`으로(단, `/select-name` 자신 제외).

- [ ] **Step 1: login 서버 액션 작성**

Create `app/actions/auth-actions.ts`:

```ts
"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase";
import { createSessionToken, SESSION_TTL_MS } from "@/lib/auth";
import { isLocked, nextStateOnFailure } from "@/lib/rate-limit";

export async function login(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string }> {
  const password = formData.get("password");
  const ip =
    (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const db = supabaseServer();
  const now = new Date();

  const { data: attempt } = await db
    .from("login_attempts")
    .select("fail_count, locked_until")
    .eq("ip", ip)
    .maybeSingle();

  if (isLocked(attempt, now)) {
    return { error: "시도 횟수를 초과했습니다. 1분 후 다시 시도하세요." };
  }

  if (password !== process.env.TEAM_PASSWORD) {
    const next = nextStateOnFailure(attempt, now);
    await db
      .from("login_attempts")
      .upsert({ ip, ...next, updated_at: now.toISOString() });
    return {
      error: next.locked_until
        ? "5회 연속 실패로 1분간 잠깁니다."
        : "비밀번호가 틀렸습니다.",
    };
  }

  await db.from("login_attempts").delete().eq("ip", ip);
  const token = await createSessionToken(process.env.SESSION_SECRET!, now);
  (await cookies()).set("team_session", token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
  redirect("/select-name");
}
```

- [ ] **Step 2: 로그인 페이지 작성**

Create `app/login/page.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { login } from "@/app/actions/auth-actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, null);
  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="mb-6 text-xl font-bold">팀 비밀번호를 입력하세요</h1>
      <form action={action} className="flex flex-col gap-3">
        <input
          type="password"
          name="password"
          required
          autoFocus
          className="rounded border px-3 py-2"
          placeholder="공용 비밀번호"
        />
        <button
          disabled={pending}
          className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
        >
          입장
        </button>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      </form>
    </main>
  );
}
```

- [ ] **Step 3: 미들웨어 작성**

Create `middleware.ts` (저장소 루트):

```ts
import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/login") return NextResponse.next();

  const token = req.cookies.get("team_session")?.value;
  const ok =
    !!token &&
    (await verifySessionToken(token, process.env.SESSION_SECRET!, new Date()));
  if (!ok) return NextResponse.redirect(new URL("/login", req.url));

  if (pathname !== "/select-name" && !req.cookies.get("member_name")?.value) {
    return NextResponse.redirect(new URL("/select-name", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|favicon.ico).*)"],
};
```

- [ ] **Step 4: 수동 검증**

Run: `npm run dev` 후 브라우저에서:
1. `http://localhost:3000/` 접속 → `/login`으로 리다이렉트됨
2. 틀린 비밀번호 5회 → "5회 연속 실패로 1분간 잠깁니다" → 6번째 시도 즉시 "1분 후 다시 시도" 안내
3. 1분 후 올바른 비밀번호(`.env.local`의 `TEAM_PASSWORD`) → `/select-name`으로 이동(404여도 리다이렉트 자체가 성공 — 페이지는 Task 8)

Expected: 위 3가지 동작 확인.

- [ ] **Step 5: Commit**

```bash
git add app/actions/auth-actions.ts app/login/page.tsx middleware.ts
git commit -m "feat: add team password gate with rate limiting"
```

---

### Task 8: 이름 선택 + 네비게이션

**Files:**
- Create: `lib/members.ts`, `lib/member.ts`, `app/select-name/page.tsx`, `components/nav.tsx`
- Modify: `app/actions/auth-actions.ts`(selectName 추가), `app/layout.tsx`(Nav 삽입)

**Interfaces:**
- Consumes: `login`(기존)
- Produces:
  - `MEMBERS: string[]` — 팀원 5명 이름
  - `getMemberName(): Promise<string | null>` — `member_name` 쿠키 decode해 반환. 이후 모든 서버 액션이 사용.
  - `selectName(formData: FormData): Promise<void>` — 쿠키 설정 후 `/`로 redirect
  - `<Nav />` — 로그인된 화면 상단 네비게이션

- [ ] **Step 1: 팀원 목록과 쿠키 헬퍼**

Create `lib/members.ts`:

```ts
// 팀원 이름을 실제 팀에 맞게 수정하세요.
export const MEMBERS = ["팀원1", "팀원2", "팀원3", "팀원4", "팀원5"];
```

Create `lib/member.ts`:

```ts
import { cookies } from "next/headers";

export async function getMemberName(): Promise<string | null> {
  const raw = (await cookies()).get("member_name")?.value;
  return raw ? decodeURIComponent(raw) : null;
}
```

- [ ] **Step 2: selectName 액션 추가**

`app/actions/auth-actions.ts` 하단에 추가:

```ts
export async function selectName(formData: FormData): Promise<void> {
  const { MEMBERS } = await import("@/lib/members");
  const name = String(formData.get("name"));
  if (!MEMBERS.includes(name)) return;
  (await cookies()).set("member_name", encodeURIComponent(name), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
  redirect("/");
}
```

- [ ] **Step 3: 이름 선택 페이지**

Create `app/select-name/page.tsx`:

```tsx
import { MEMBERS } from "@/lib/members";
import { selectName } from "@/app/actions/auth-actions";

export default function SelectNamePage() {
  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="mb-6 text-xl font-bold">이름을 선택하세요</h1>
      <form action={selectName} className="flex flex-col gap-2">
        {MEMBERS.map((m) => (
          <button
            key={m}
            name="name"
            value={m}
            className="rounded border p-3 text-left hover:bg-gray-50"
          >
            {m}
          </button>
        ))}
      </form>
    </main>
  );
}
```

- [ ] **Step 4: 네비게이션 + 레이아웃**

Create `components/nav.tsx`:

```tsx
import Link from "next/link";
import { getMemberName } from "@/lib/member";

export default async function Nav() {
  const name = await getMemberName();
  if (!name) return null;
  return (
    <nav className="flex items-center gap-4 border-b px-4 py-3">
      <Link href="/" className="font-bold">
        goodProgram
      </Link>
      <Link href="/">인강 목록</Link>
      <Link href="/schedule">시간표</Link>
      <Link href="/admin">관리</Link>
      <span className="ml-auto text-sm text-gray-500">
        {name}{" "}
        <Link href="/select-name" className="underline">
          변경
        </Link>
      </span>
    </nav>
  );
}
```

`app/layout.tsx` 수정 — `<body>` 안을 다음처럼 변경(기존 폰트/클래스는 유지):

```tsx
import Nav from "@/components/nav";
// ... 기존 import/폰트 설정 유지 ...

// body 내부:
//   <body className={...기존 유지...}>
//     <Nav />
//     {children}
//   </body>
```

- [ ] **Step 5: 수동 검증**

Run: `npm run dev` 후:
1. 로그인 → `/select-name`에서 이름 5개 버튼 표시 → 하나 클릭 → `/`로 이동(아직 기본 페이지)
2. 상단에 Nav(인강 목록/시간표/관리/이름+변경) 표시
3. "변경" 클릭 → 이름 재선택 가능

Expected: 위 동작 확인.

- [ ] **Step 6: Commit**

```bash
git add lib/members.ts lib/member.ts app/select-name app/actions/auth-actions.ts components/nav.tsx app/layout.tsx
git commit -m "feat: add member name selection and nav"
```

---

### Task 9: 현황 API + 폴링 훅

**Files:**
- Create: `app/api/status/route.ts`, `lib/use-polling.ts`

**Interfaces:**
- Consumes: `supabaseServer`, `findActiveSession`, `effectiveCheckoutAt`, `kstDayRange`, `StatusPayload`
- Produces:
  - `GET /api/status` → `StatusPayload` JSON (계정 비밀번호 **미포함**)
  - `usePolling<T>(url: string | null, intervalMs?: number): { data: T | null; refresh: () => void }` — url이 null이면 아무것도 안 함. 기본 5000ms.

- [ ] **Step 1: 현황 API 작성**

Create `app/api/status/route.ts`:

```ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { findActiveSession, effectiveCheckoutAt } from "@/lib/availability";
import { kstDayRange } from "@/lib/time";
import type { Session, StatusPayload } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = supabaseServer();
  const now = new Date();
  const today = kstDayRange(now);

  const [accountsRes, coursesRes, sessionsRes, reservationsRes] =
    await Promise.all([
      db.from("accounts").select("id,label,site").order("created_at"),
      db.from("courses").select("id,title,category,account_id").order("title"),
      db.from("sessions").select("*").is("checked_out_at", null),
      db
        .from("reservations")
        .select("id,course_id,account_id,member_name,start_at,end_at")
        .gte("start_at", today.start.toISOString())
        .lt("start_at", today.end.toISOString())
        .order("start_at"),
    ]);

  const sessions = (sessionsRes.data ?? []) as Session[];
  const payload: StatusPayload = {
    accounts: (accountsRes.data ?? []).map((a) => {
      const active = findActiveSession(sessions, a.id, now);
      return {
        ...a,
        activeSession: active
          ? {
              id: active.id,
              member_name: active.member_name,
              effective_checkout_at: effectiveCheckoutAt(active).toISOString(),
            }
          : null,
      };
    }),
    courses: coursesRes.data ?? [],
    todayReservations: reservationsRes.data ?? [],
  };
  return NextResponse.json(payload);
}
```

- [ ] **Step 2: 폴링 훅 작성**

Create `lib/use-polling.ts`:

```ts
"use client";

import { useEffect, useState } from "react";

export function usePolling<T>(
  url: string | null,
  intervalMs = 5000,
): { data: T | null; refresh: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!url) return;
    let alive = true;
    const load = () =>
      fetch(url)
        .then((r) => r.json())
        .then((d) => {
          if (alive) setData(d);
        })
        .catch(() => {});
    load();
    const t = setInterval(load, intervalMs);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [url, intervalMs, tick]);

  return { data, refresh: () => setTick((t) => t + 1) };
}
```

- [ ] **Step 3: 수동 검증**

Run: `npm run dev` → 브라우저에서 로그인·이름 선택 후 `http://localhost:3000/api/status` 접속.

Expected: 시드 데이터 기준 계정 2개(`activeSession: null`), 인강 3개, `todayReservations: []` JSON. **`login_id`/`login_password` 필드가 없는지 반드시 확인.**

- [ ] **Step 4: Commit**

```bash
git add app/api/status/route.ts lib/use-polling.ts
git commit -m "feat: add status API and polling hook"
```

---

### Task 10: 체크인/체크아웃/계정 정보 서버 액션

**Files:**
- Create: `app/actions/session-actions.ts`

**Interfaces:**
- Consumes: `supabaseServer`, `getMemberName`, `findActiveSession`, `AccountWithCredentials`, `Session`
- Produces:
  - `checkIn(accountId: string, plannedCheckoutAt: string | null): Promise<{ error?: string }>` — 이미 사용 중이면 `{ error: "OO님이 사용 중입니다." }`
  - `checkOut(accountId: string): Promise<{ error?: string }>` — 해당 계정의 열린 세션 전부 `checked_out_at = now` (신뢰 기반: 누구든 종료 가능, 좀비 세션 정리 겸용)
  - `getAccountCredentials(accountId: string): Promise<AccountWithCredentials | null>`

- [ ] **Step 1: 구현**

Create `app/actions/session-actions.ts`:

```ts
"use server";

import { supabaseServer } from "@/lib/supabase";
import { getMemberName } from "@/lib/member";
import { findActiveSession } from "@/lib/availability";
import type { AccountWithCredentials, Session } from "@/lib/types";

export async function checkIn(
  accountId: string,
  plannedCheckoutAt: string | null,
): Promise<{ error?: string }> {
  const name = await getMemberName();
  if (!name) return { error: "이름을 먼저 선택하세요." };

  const db = supabaseServer();
  const now = new Date();
  const { data } = await db
    .from("sessions")
    .select("*")
    .eq("account_id", accountId)
    .is("checked_out_at", null);

  const active = findActiveSession((data ?? []) as Session[], accountId, now);
  if (active) return { error: `${active.member_name}님이 사용 중입니다.` };

  const { error } = await db.from("sessions").insert({
    account_id: accountId,
    member_name: name,
    planned_checkout_at: plannedCheckoutAt,
  });
  if (error) return { error: "체크인에 실패했습니다." };
  return {};
}

export async function checkOut(accountId: string): Promise<{ error?: string }> {
  const db = supabaseServer();
  const { error } = await db
    .from("sessions")
    .update({ checked_out_at: new Date().toISOString() })
    .eq("account_id", accountId)
    .is("checked_out_at", null);
  if (error) return { error: "체크아웃에 실패했습니다." };
  return {};
}

export async function getAccountCredentials(
  accountId: string,
): Promise<AccountWithCredentials | null> {
  const db = supabaseServer();
  const { data } = await db
    .from("accounts")
    .select("id,label,site,login_id,login_password")
    .eq("id", accountId)
    .maybeSingle();
  return data;
}
```

- [ ] **Step 2: 빌드 확인**

Run: `npm run build`
Expected: 성공. (기능 검증은 Task 11의 UI에서 수행 — 이 액션들은 UI 없이는 호출 경로가 없음)

- [ ] **Step 3: Commit**

```bash
git add app/actions/session-actions.ts
git commit -m "feat: add check-in/check-out and credentials actions"
```

---

### Task 11: 인강 목록 페이지 (페이지 1)

**Files:**
- Create: `components/checkin-controls.tsx`, `components/account-modal.tsx`, `components/course-list.tsx`
- Modify: `app/page.tsx` (기본 페이지 전체 교체)

**Interfaces:**
- Consumes: `usePolling`, `StatusPayload`, `checkIn`/`checkOut`/`getAccountCredentials`
- Produces:
  - `<CheckinControls accountId active onChanged />` — `active: { member_name: string } | null`, `onChanged: () => void`. 카드·모달 공용.
  - `<AccountModal accountId active onClose onChanged />`
  - `<CourseList />` — 페이지 1 전체 클라이언트 컴포넌트

- [ ] **Step 1: 체크인 컨트롤 작성**

Create `components/checkin-controls.tsx`:

```tsx
"use client";

import { useState } from "react";
import { checkIn, checkOut } from "@/app/actions/session-actions";

const CHECKOUT_OPTIONS = [
  { label: "미정 (2시간 후 자동)", minutes: null },
  { label: "30분 후", minutes: 30 },
  { label: "1시간 후", minutes: 60 },
  { label: "1시간 30분 후", minutes: 90 },
  { label: "2시간 후", minutes: 120 },
] as const;

export function CheckinControls({
  accountId,
  active,
  onChanged,
}: {
  accountId: string;
  active: { member_name: string } | null;
  onChanged: () => void;
}) {
  const [minutes, setMinutes] = useState("null");
  const [error, setError] = useState<string | null>(null);

  async function handleCheckIn() {
    const m = minutes === "null" ? null : Number(minutes);
    const planned = m ? new Date(Date.now() + m * 60_000).toISOString() : null;
    const res = await checkIn(accountId, planned);
    setError(res.error ?? null);
    onChanged();
  }

  async function handleCheckOut() {
    const res = await checkOut(accountId);
    setError(res.error ?? null);
    onChanged();
  }

  if (active) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={handleCheckOut}
          className="rounded bg-red-100 px-2 py-1 text-sm"
        >
          사용 종료
        </button>
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={minutes}
        onChange={(e) => setMinutes(e.target.value)}
        className="rounded border px-1 py-1 text-sm"
      >
        {CHECKOUT_OPTIONS.map((o) => (
          <option key={o.label} value={String(o.minutes)}>
            {o.label}
          </option>
        ))}
      </select>
      <button
        onClick={handleCheckIn}
        className="rounded bg-green-100 px-2 py-1 text-sm"
      >
        사용 시작
      </button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  );
}
```

- [ ] **Step 2: 계정 확인 모달 작성**

Create `components/account-modal.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { getAccountCredentials } from "@/app/actions/session-actions";
import type { AccountWithCredentials } from "@/lib/types";
import { CheckinControls } from "./checkin-controls";

function CredRow({
  label,
  value,
  masked,
  onToggle,
}: {
  label: string;
  value: string;
  masked?: boolean;
  onToggle?: () => void;
}) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="w-16 shrink-0 text-sm text-gray-500">{label}</span>
      <code className="flex-1 overflow-x-auto rounded bg-gray-100 px-2 py-1 text-sm">
        {masked ? "••••••••" : value}
      </code>
      {onToggle && (
        <button onClick={onToggle} className="shrink-0 text-sm underline">
          {masked ? "보기" : "숨기기"}
        </button>
      )}
      <button
        onClick={() => navigator.clipboard.writeText(value)}
        className="shrink-0 text-sm underline"
      >
        복사
      </button>
    </div>
  );
}

export function AccountModal({
  accountId,
  active,
  onClose,
  onChanged,
}: {
  accountId: string;
  active: { member_name: string } | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [creds, setCreds] = useState<AccountWithCredentials | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    getAccountCredentials(accountId).then(setCreds);
  }, [accountId]);

  return (
    <div
      className="fixed inset-0 z-10 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {creds ? (
          <>
            <h2 className="mb-1 text-lg font-bold">{creds.label}</h2>
            <p className="mb-4 text-sm text-gray-600">
              {creds.site} 에 아래 계정으로 로그인하세요.
            </p>
            <CredRow label="아이디" value={creds.login_id} />
            <CredRow
              label="비밀번호"
              value={creds.login_password}
              masked={!show}
              onToggle={() => setShow((s) => !s)}
            />
            <div className="mt-4">
              <CheckinControls
                accountId={accountId}
                active={active}
                onChanged={onChanged}
              />
            </div>
          </>
        ) : (
          <p>불러오는 중…</p>
        )}
        <button onClick={onClose} className="mt-4 text-sm underline">
          닫기
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 인강 목록 작성**

Create `components/course-list.tsx`:

```tsx
"use client";

import { useState } from "react";
import { usePolling } from "@/lib/use-polling";
import type { Reservation, StatusPayload } from "@/lib/types";
import { CheckinControls } from "./checkin-controls";
import { AccountModal } from "./account-modal";

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function nextTodayReservation(
  reservations: Reservation[],
  accountId: string,
): Reservation | null {
  const now = Date.now();
  return (
    reservations.find(
      (r) => r.account_id === accountId && new Date(r.end_at).getTime() > now,
    ) ?? null
  );
}

export function CourseList() {
  const { data, refresh } = usePolling<StatusPayload>("/api/status");
  const [category, setCategory] = useState("전체");
  const [query, setQuery] = useState("");
  const [modalAccountId, setModalAccountId] = useState<string | null>(null);

  if (!data) return <p className="p-8">불러오는 중…</p>;

  const categories = [
    "전체",
    ...Array.from(new Set(data.courses.map((c) => c.category))),
  ];
  const courses = data.courses.filter(
    (c) =>
      (category === "전체" || c.category === category) &&
      c.title.includes(query),
  );
  const accountOf = (id: string) => data.accounts.find((a) => a.id === id);
  const modalAccount = modalAccountId ? accountOf(modalAccountId) : null;

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`rounded-full border px-3 py-1 text-sm ${
              category === c ? "bg-black text-white" : "hover:bg-gray-50"
            }`}
          >
            {c}
          </button>
        ))}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="제목 검색"
          className="ml-auto rounded border px-3 py-1 text-sm"
        />
      </div>

      <ul className="flex flex-col gap-3">
        {courses.map((course) => {
          const account = accountOf(course.account_id);
          if (!account) return null;
          const active = account.activeSession;
          const nextRes = nextTodayReservation(
            data.todayReservations,
            account.id,
          );
          return (
            <li key={course.id} className="rounded border p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="font-bold">{course.title}</span>
                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs">
                  {course.category}
                </span>
                <span className="text-sm text-gray-500">{account.label}</span>
                {active ? (
                  <span className="ml-auto rounded bg-red-100 px-2 py-0.5 text-sm">
                    🔴 {active.member_name} 사용 중 (~
                    {fmtTime(active.effective_checkout_at)})
                  </span>
                ) : (
                  <span className="ml-auto rounded bg-green-100 px-2 py-0.5 text-sm">
                    🟢 사용 가능
                  </span>
                )}
              </div>
              {nextRes && (
                <p className="mb-2 text-sm text-gray-600">
                  다음 예약: {nextRes.member_name} {fmtTime(nextRes.start_at)}~
                  {fmtTime(nextRes.end_at)}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <CheckinControls
                  accountId={account.id}
                  active={active}
                  onChanged={refresh}
                />
                <button
                  onClick={() => setModalAccountId(account.id)}
                  className="text-sm underline"
                >
                  계정 확인하기
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {modalAccountId && (
        <AccountModal
          accountId={modalAccountId}
          active={modalAccount?.activeSession ?? null}
          onClose={() => setModalAccountId(null)}
          onChanged={refresh}
        />
      )}
    </main>
  );
}
```

- [ ] **Step 4: 페이지 교체**

Replace `app/page.tsx` 전체:

```tsx
import { CourseList } from "@/components/course-list";

export default function Home() {
  return <CourseList />;
}
```

- [ ] **Step 5: 수동 검증**

Run: `npm run dev` 후:
1. `/` 에서 시드 인강 3개 표시, 카테고리 칩(전체/backend/frontend/server) 필터 동작, 제목 검색 동작
2. "사용 시작"(미정) → 🔴 배지에 내 이름 + 예상 종료 시각(~2시간 후) 표시, 같은 계정의 다른 인강 카드도 🔴
3. 다른 이름으로 바꿔 같은 계정 체크인 시도 → "OO님이 사용 중입니다."
4. "사용 종료" → 🟢 복귀
5. "계정 확인하기" → 모달에 사이트/아이디 표시, 비밀번호 마스킹 + 보기 토글, 복사 버튼으로 실제 클립보드 복사 확인, 모달 안 체크인/체크아웃 동작

Expected: 전부 동작.

- [ ] **Step 6: Commit**

```bash
git add components/checkin-controls.tsx components/account-modal.tsx components/course-list.tsx app/page.tsx
git commit -m "feat: add course list page with check-in and account modal"
```

---

### Task 12: 주간/슬롯 계산 (TDD)

**Files:**
- Create: `lib/slots.ts`
- Test: `tests/slots.test.ts`

**Interfaces:**
- Produces:
  - `weekStart(now: Date): Date` — 로컬 시간 기준 이번 주 월요일 00:00
  - `addDays(d: Date, n: number): Date`
  - `slotTimes(): string[]` — `["09:00", "09:30", ..., "23:30"]` (30개)
  - `slotRange(day: Date, label: string): { start: Date; end: Date }` — 해당 날짜의 30분 슬롯 구간

- [ ] **Step 1: 실패하는 테스트 작성**

Create `tests/slots.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { weekStart, addDays, slotTimes, slotRange } from "@/lib/slots";

describe("weekStart", () => {
  it("수요일 → 그 주 월요일 00:00", () => {
    // 2026-07-22는 수요일
    const d = weekStart(new Date(2026, 6, 22, 15, 30));
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6);
    expect(d.getDate()).toBe(20); // 월요일
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });

  it("일요일 → 지난 월요일", () => {
    // 2026-07-26은 일요일
    const d = weekStart(new Date(2026, 6, 26, 10, 0));
    expect(d.getDate()).toBe(20);
  });
});

describe("slotTimes", () => {
  it("09:00~23:30, 30분 단위 30개", () => {
    const t = slotTimes();
    expect(t).toHaveLength(30);
    expect(t[0]).toBe("09:00");
    expect(t[t.length - 1]).toBe("23:30");
  });
});

describe("slotRange", () => {
  it("슬롯 라벨로 30분 구간 생성", () => {
    const day = new Date(2026, 6, 20);
    const { start, end } = slotRange(day, "09:30");
    expect(start.getHours()).toBe(9);
    expect(start.getMinutes()).toBe(30);
    expect(end.getTime() - start.getTime()).toBe(30 * 60 * 1000);
  });
});

describe("addDays", () => {
  it("날짜 더하기", () => {
    expect(addDays(new Date(2026, 6, 20), 6).getDate()).toBe(26);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test`
Expected: FAIL — `Cannot find module '@/lib/slots'`.

- [ ] **Step 3: 구현**

Create `lib/slots.ts`:

```ts
export function weekStart(now: Date): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const daysSinceMonday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - daysSinceMonday);
  return d;
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function slotTimes(): string[] {
  const out: string[] = [];
  for (let h = 9; h < 24; h++) {
    for (const m of [0, 30]) {
      out.push(
        `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
      );
    }
  }
  return out;
}

export function slotRange(day: Date, label: string): { start: Date; end: Date } {
  const [h, m] = label.split(":").map(Number);
  const start = new Date(day);
  start.setHours(h, m, 0, 0);
  return { start, end: new Date(start.getTime() + 30 * 60 * 1000) };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test`
Expected: 전부 PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/slots.ts tests/slots.test.ts
git commit -m "feat: add week/slot helpers for timetable"
```

---

### Task 13: 예약 액션 + 주간 예약 API

**Files:**
- Create: `app/actions/reservation-actions.ts`, `app/api/reservations/route.ts`

**Interfaces:**
- Consumes: `supabaseServer`, `getMemberName`, `Reservation`
- Produces:
  - `createReservation(input: { accountId: string; courseId: string | null; startAt: string; endAt: string }): Promise<{ error?: string }>` — 겹침이면 `{ error: "이미 예약된 시간입니다." }` (Postgres exclusion 위반 코드 `23P01`)
  - `cancelReservation(id: string): Promise<{ error?: string }>` — 본인 예약만 삭제
  - `GET /api/reservations?accountId=&start=ISO&end=ISO` → `{ reservations: Reservation[] }` — 구간과 **겹치는** 예약 반환

- [ ] **Step 1: 예약 액션 작성**

Create `app/actions/reservation-actions.ts`:

```ts
"use server";

import { supabaseServer } from "@/lib/supabase";
import { getMemberName } from "@/lib/member";

export async function createReservation(input: {
  accountId: string;
  courseId: string | null;
  startAt: string;
  endAt: string;
}): Promise<{ error?: string }> {
  const name = await getMemberName();
  if (!name) return { error: "이름을 먼저 선택하세요." };

  const db = supabaseServer();
  const { error } = await db.from("reservations").insert({
    account_id: input.accountId,
    course_id: input.courseId,
    member_name: name,
    start_at: input.startAt,
    end_at: input.endAt,
  });
  if (error?.code === "23P01") return { error: "이미 예약된 시간입니다." };
  if (error) return { error: "예약에 실패했습니다." };
  return {};
}

export async function cancelReservation(id: string): Promise<{ error?: string }> {
  const name = await getMemberName();
  if (!name) return { error: "이름을 먼저 선택하세요." };

  const db = supabaseServer();
  const { error } = await db
    .from("reservations")
    .delete()
    .eq("id", id)
    .eq("member_name", name);
  if (error) return { error: "취소에 실패했습니다." };
  return {};
}
```

- [ ] **Step 2: 주간 예약 API 작성**

Create `app/api/reservations/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get("accountId");
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  if (!accountId || !start || !end) {
    return NextResponse.json({ error: "missing params" }, { status: 400 });
  }

  const db = supabaseServer();
  const { data } = await db
    .from("reservations")
    .select("id,course_id,account_id,member_name,start_at,end_at")
    .eq("account_id", accountId)
    .lt("start_at", end)
    .gt("end_at", start)
    .order("start_at");

  return NextResponse.json({ reservations: data ?? [] });
}
```

- [ ] **Step 3: 빌드 확인**

Run: `npm run build`
Expected: 성공. (기능 검증은 Task 14 UI에서 — 겹침 오류 포함)

- [ ] **Step 4: Commit**

```bash
git add app/actions/reservation-actions.ts app/api/reservations/route.ts
git commit -m "feat: add reservation actions and weekly reservations API"
```

---

### Task 14: 시간표 페이지 (페이지 2)

**Files:**
- Create: `components/schedule-grid.tsx`, `app/schedule/page.tsx`

**Interfaces:**
- Consumes: `usePolling`, `StatusPayload`, `Reservation`, `weekStart`/`addDays`/`slotTimes`/`slotRange`, `createReservation`/`cancelReservation`, `getMemberName`
- Produces: `<ScheduleGrid myName />` — 왼쪽 계정 사이드바 + 선택 계정의 주간 그리드(열: 월~일, 행: 09:00~23:30 30분). 예약 슬롯: 초록 + 예약자 이름, 본인 것 클릭 시 취소. 빈 슬롯: 흰색, 클릭 시 인강 선택 다이얼로그 → 예약.

- [ ] **Step 1: 그리드 컴포넌트 작성**

Create `components/schedule-grid.tsx`:

```tsx
"use client";

import { useState } from "react";
import { usePolling } from "@/lib/use-polling";
import type { Reservation, StatusPayload } from "@/lib/types";
import { weekStart, addDays, slotTimes, slotRange } from "@/lib/slots";
import {
  createReservation,
  cancelReservation,
} from "@/app/actions/reservation-actions";

const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

export function ScheduleGrid({ myName }: { myName: string }) {
  const { data: status } = usePolling<StatusPayload>("/api/status");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [pending, setPending] = useState<{ start: Date; end: Date } | null>(null);
  const [courseId, setCourseId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const start = weekStart(new Date());
  const end = addDays(start, 7);
  const url = accountId
    ? `/api/reservations?accountId=${accountId}&start=${start.toISOString()}&end=${end.toISOString()}`
    : null;
  const { data: resData, refresh } = usePolling<{ reservations: Reservation[] }>(url);
  const reservations = resData?.reservations ?? [];

  if (!status) return <p className="p-8">불러오는 중…</p>;
  const selected = accountId ?? status.accounts[0]?.id ?? null;
  if (accountId === null && selected) setAccountId(selected);

  const accountCourses = status.courses.filter((c) => c.account_id === selected);

  function findReservation(slotStart: Date, slotEnd: Date): Reservation | null {
    return (
      reservations.find(
        (r) =>
          new Date(r.start_at) < slotEnd && new Date(r.end_at) > slotStart,
      ) ?? null
    );
  }

  async function handleReserve() {
    if (!pending || !selected) return;
    const res = await createReservation({
      accountId: selected,
      courseId: courseId || null,
      startAt: pending.start.toISOString(),
      endAt: pending.end.toISOString(),
    });
    setError(res.error ?? null);
    setPending(null);
    setCourseId("");
    refresh();
  }

  async function handleCancel(r: Reservation) {
    if (r.member_name !== myName) return;
    if (!window.confirm("이 예약을 취소할까요?")) return;
    const res = await cancelReservation(r.id);
    setError(res.error ?? null);
    refresh();
  }

  return (
    <main className="flex gap-4 p-4">
      <aside className="w-40 shrink-0">
        <h2 className="mb-2 font-bold">계정</h2>
        <ul className="flex flex-col gap-1">
          {status.accounts.map((a) => (
            <li key={a.id}>
              <button
                onClick={() => setAccountId(a.id)}
                className={`w-full rounded border px-2 py-2 text-left text-sm ${
                  selected === a.id ? "bg-black text-white" : "hover:bg-gray-50"
                }`}
              >
                {a.label}
                {a.activeSession && (
                  <span className="block text-xs">
                    🔴 {a.activeSession.member_name}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <div className="grow overflow-x-auto">
        {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="w-14 border p-1"></th>
              {DAY_LABELS.map((d, i) => (
                <th key={d} className="border p-1">
                  {d} {addDays(start, i).getDate()}일
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slotTimes().map((label) => (
              <tr key={label}>
                <td className="border p-1 text-right text-gray-500">{label}</td>
                {DAY_LABELS.map((_, i) => {
                  const day = addDays(start, i);
                  const range = slotRange(day, label);
                  const r = findReservation(range.start, range.end);
                  if (r) {
                    return (
                      <td
                        key={i}
                        onClick={() => handleCancel(r)}
                        className={`border bg-green-200 p-1 text-center ${
                          r.member_name === myName ? "cursor-pointer" : ""
                        }`}
                        title={r.member_name === myName ? "클릭하여 취소" : ""}
                      >
                        {r.member_name}
                      </td>
                    );
                  }
                  return (
                    <td
                      key={i}
                      onClick={() => setPending(range)}
                      className="cursor-pointer border bg-white p-1 hover:bg-gray-100"
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pending && (
        <div
          className="fixed inset-0 z-10 flex items-center justify-center bg-black/40"
          onClick={() => setPending(null)}
        >
          <div
            className="w-full max-w-sm rounded bg-white p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-3 font-bold">
              {pending.start.getMonth() + 1}/{pending.start.getDate()}{" "}
              {String(pending.start.getHours()).padStart(2, "0")}:
              {String(pending.start.getMinutes()).padStart(2, "0")} 예약
            </h2>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="mb-3 w-full rounded border px-2 py-1 text-sm"
            >
              <option value="">인강 선택 안 함</option>
              {accountCourses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={handleReserve}
                className="rounded bg-black px-3 py-1 text-sm text-white"
              >
                예약
              </button>
              <button
                onClick={() => setPending(null)}
                className="rounded border px-3 py-1 text-sm"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 2: 페이지 작성**

Create `app/schedule/page.tsx`:

```tsx
import { getMemberName } from "@/lib/member";
import { ScheduleGrid } from "@/components/schedule-grid";

export default async function SchedulePage() {
  const myName = (await getMemberName()) ?? "";
  return <ScheduleGrid myName={myName} />;
}
```

- [ ] **Step 3: 수동 검증**

Run: `npm run dev` 후 `/schedule` 에서:
1. 왼쪽 사이드바에 계정 2개, 첫 계정 자동 선택, 계정 클릭 전환 동작
2. 그리드: 열 월~일(날짜 포함), 행 09:00~23:30 30개
3. 빈 슬롯 클릭 → 다이얼로그(그 계정의 인강만 목록) → 예약 → 슬롯 초록 + 내 이름
4. 같은 슬롯을 다른 이름으로 예약 시도 → "이미 예약된 시간입니다."
5. 내 예약 클릭 → confirm → 취소됨. 남의 예약은 클릭해도 반응 없음
6. 오늘 시간대에 예약 후 `/` 인강 카드에 "다음 예약: 이름 HH:MM~HH:MM" 표시 확인

Expected: 전부 동작.

- [ ] **Step 4: Commit**

```bash
git add components/schedule-grid.tsx app/schedule/page.tsx
git commit -m "feat: add weekly schedule page with reservations"
```

---

### Task 15: 관리 화면

**Files:**
- Create: `app/actions/admin-actions.ts`, `app/admin/page.tsx`

**Interfaces:**
- Consumes: `supabaseServer`
- Produces: FormData 기반 서버 액션 — `createAccount`, `updateAccount`, `deleteAccount`, `createCourse`, `updateCourse`, `deleteCourse` (모두 `Promise<void>`, 처리 후 `revalidatePath("/admin")`)

- [ ] **Step 1: 관리 액션 작성**

Create `app/actions/admin-actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function createAccount(formData: FormData): Promise<void> {
  const db = supabaseServer();
  await db.from("accounts").insert({
    label: str(formData, "label"),
    site: str(formData, "site"),
    login_id: str(formData, "login_id"),
    login_password: str(formData, "login_password"),
  });
  revalidatePath("/admin");
}

export async function updateAccount(formData: FormData): Promise<void> {
  const db = supabaseServer();
  await db
    .from("accounts")
    .update({
      label: str(formData, "label"),
      site: str(formData, "site"),
      login_id: str(formData, "login_id"),
      login_password: str(formData, "login_password"),
    })
    .eq("id", str(formData, "id"));
  revalidatePath("/admin");
}

export async function deleteAccount(formData: FormData): Promise<void> {
  const db = supabaseServer();
  await db.from("accounts").delete().eq("id", str(formData, "id"));
  revalidatePath("/admin");
}

export async function createCourse(formData: FormData): Promise<void> {
  const db = supabaseServer();
  await db.from("courses").insert({
    title: str(formData, "title"),
    category: str(formData, "category"),
    account_id: str(formData, "account_id"),
  });
  revalidatePath("/admin");
}

export async function updateCourse(formData: FormData): Promise<void> {
  const db = supabaseServer();
  await db
    .from("courses")
    .update({
      title: str(formData, "title"),
      category: str(formData, "category"),
      account_id: str(formData, "account_id"),
    })
    .eq("id", str(formData, "id"));
  revalidatePath("/admin");
}

export async function deleteCourse(formData: FormData): Promise<void> {
  const db = supabaseServer();
  await db.from("courses").delete().eq("id", str(formData, "id"));
  revalidatePath("/admin");
}
```

- [ ] **Step 2: 관리 페이지 작성**

Create `app/admin/page.tsx`:

```tsx
import { supabaseServer } from "@/lib/supabase";
import {
  createAccount,
  updateAccount,
  deleteAccount,
  createCourse,
  updateCourse,
  deleteCourse,
} from "@/app/actions/admin-actions";

export const dynamic = "force-dynamic";

type AccountRow = {
  id: string;
  label: string;
  site: string;
  login_id: string;
  login_password: string;
};
type CourseRow = {
  id: string;
  title: string;
  category: string;
  account_id: string;
};

const inputCls = "rounded border px-2 py-1 text-sm";
const btnCls = "rounded bg-black px-3 py-1 text-sm text-white";
const delBtnCls = "rounded bg-red-100 px-3 py-1 text-sm";

export default async function AdminPage() {
  const db = supabaseServer();
  const [{ data: accounts }, { data: courses }] = await Promise.all([
    db
      .from("accounts")
      .select("id,label,site,login_id,login_password")
      .order("created_at"),
    db.from("courses").select("id,title,category,account_id").order("title"),
  ]);
  const accountRows = (accounts ?? []) as AccountRow[];
  const courseRows = (courses ?? []) as CourseRow[];
  const labelOf = (id: string) =>
    accountRows.find((a) => a.id === id)?.label ?? "?";

  return (
    <main className="mx-auto max-w-3xl p-6">
      <section className="mb-10">
        <h1 className="mb-3 text-lg font-bold">계정 관리</h1>
        <form action={createAccount} className="mb-4 flex flex-wrap gap-2">
          <input name="label" placeholder="라벨 (계정1)" required className={inputCls} />
          <input name="site" placeholder="사이트" required className={inputCls} />
          <input name="login_id" placeholder="아이디" required className={inputCls} />
          <input name="login_password" placeholder="비밀번호" required className={inputCls} />
          <button className={btnCls}>추가</button>
        </form>
        <ul className="flex flex-col gap-2">
          {accountRows.map((a) => (
            <li key={a.id} className="rounded border p-3">
              <details>
                <summary className="cursor-pointer text-sm">
                  <b>{a.label}</b> — {a.site} ({a.login_id})
                </summary>
                <form action={updateAccount} className="mt-2 flex flex-wrap gap-2">
                  <input type="hidden" name="id" value={a.id} />
                  <input name="label" defaultValue={a.label} required className={inputCls} />
                  <input name="site" defaultValue={a.site} required className={inputCls} />
                  <input name="login_id" defaultValue={a.login_id} required className={inputCls} />
                  <input name="login_password" defaultValue={a.login_password} required className={inputCls} />
                  <button className={btnCls}>수정</button>
                </form>
                <form action={deleteAccount} className="mt-2">
                  <input type="hidden" name="id" value={a.id} />
                  <button className={delBtnCls}>삭제 (묶인 인강·예약도 삭제됨)</button>
                </form>
              </details>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h1 className="mb-3 text-lg font-bold">인강 관리</h1>
        <form action={createCourse} className="mb-4 flex flex-wrap gap-2">
          <input name="title" placeholder="제목" required className={inputCls} />
          <input name="category" placeholder="카테고리 (backend)" required className={inputCls} />
          <select name="account_id" required className={inputCls}>
            {accountRows.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
          <button className={btnCls}>추가</button>
        </form>
        <ul className="flex flex-col gap-2">
          {courseRows.map((c) => (
            <li key={c.id} className="rounded border p-3">
              <details>
                <summary className="cursor-pointer text-sm">
                  <b>{c.title}</b> — {c.category} / {labelOf(c.account_id)}
                </summary>
                <form action={updateCourse} className="mt-2 flex flex-wrap gap-2">
                  <input type="hidden" name="id" value={c.id} />
                  <input name="title" defaultValue={c.title} required className={inputCls} />
                  <input name="category" defaultValue={c.category} required className={inputCls} />
                  <select name="account_id" defaultValue={c.account_id} required className={inputCls}>
                    {accountRows.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                  <button className={btnCls}>수정</button>
                </form>
                <form action={deleteCourse} className="mt-2">
                  <input type="hidden" name="id" value={c.id} />
                  <button className={delBtnCls}>삭제</button>
                </form>
              </details>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
```

- [ ] **Step 3: 수동 검증**

Run: `npm run dev` 후 `/admin` 에서:
1. 계정 추가 → 목록에 표시 → `/` 와 `/schedule` 사이드바에도 반영
2. 계정 펼쳐서 수정 → 반영 확인
3. 인강 추가(계정 선택 포함)/수정/삭제 → `/` 목록 반영
4. 계정 삭제 → 묶인 인강도 함께 사라짐(cascade)

Expected: 전부 동작.

- [ ] **Step 4: Commit**

```bash
git add app/actions/admin-actions.ts app/admin/page.tsx
git commit -m "feat: add admin page for accounts and courses"
```

---

### Task 16: README + 배포 문서

**Files:**
- Modify: `README.md` (전체 재작성 — Task 1에서 create-next-app 기본 내용으로 덮어써진 상태)

**Interfaces:**
- Consumes: 없음 (문서만)

- [ ] **Step 1: 전체 테스트 + 빌드 최종 확인**

Run: `npm test && npm run build`
Expected: 테스트 전부 PASS, 빌드 성공.

- [ ] **Step 2: README 재작성**

Replace `README.md` 전체:

```markdown
# goodProgram — 인강 계정 공유 시간 관리

팀 5명이 인강 계정 점유 현황과 예약을 공유해 동시 접속 충돌을 막는 웹앱.

## 기능

- **인강 목록**: 카테고리 필터 + 제목 검색, 계정별 사용 가능(🟢)/사용 중(🔴) 표시, 당일 예약 표시
- **체크인/체크아웃**: 체크아웃 예정 시간 지정, "미정"이면 2시간 후 자동 해제
- **계정 확인하기**: 로그인 정보 표시 + 아이디/비밀번호 복사 (비밀번호 기본 마스킹)
- **시간표**: 계정별 주간 예약표 (월~일 × 09:00~24:00, 30분 슬롯), 겹침 방지
- **관리**: 계정/인강 추가·수정·삭제
- **보안**: 팀 공용 비밀번호 게이트, 5회 실패 시 1분 잠금

## 로컬 실행

1. Supabase 무료 프로젝트 생성 → SQL Editor에서 `supabase/schema.sql` 실행 (샘플 데이터가 필요하면 `supabase/seed.sql`도 실행)
2. `.env.local.example`을 `.env.local`로 복사 후 값 입력:
   - `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`: Supabase Settings > API
   - `TEAM_PASSWORD`: 팀이 정한 공용 비밀번호
   - `SESSION_SECRET`: `openssl rand -hex 32`
3. `lib/members.ts`의 팀원 이름 5명 수정
4. `npm install && npm run dev` → http://localhost:3000

## 테스트

    npm test

## Vercel 배포

1. GitHub에 push
2. [vercel.com](https://vercel.com)에서 저장소 Import
3. Environment Variables에 `.env.local`의 4개 변수 등록
4. Deploy → 발급된 URL을 팀에 공유
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: rewrite README with setup and deploy guide"
```

---

## 검증 요약 (전체 완료 시)

- `npm test` — 순수 로직 5개 모듈(availability, auth, rate-limit, time, slots) 전부 PASS
- `npm run build` — 성공
- 수동 시나리오: 로그인 게이트(5회 잠금) → 이름 선택 → 목록 필터/검색 → 체크인(미정/시간 지정)/충돌 안내/체크아웃 → 계정 모달 복사 → 시간표 예약/겹침 안내/취소 → 관리 CRUD
