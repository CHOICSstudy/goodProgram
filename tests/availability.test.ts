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
