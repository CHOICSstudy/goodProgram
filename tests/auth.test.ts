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
