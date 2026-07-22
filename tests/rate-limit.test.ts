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
