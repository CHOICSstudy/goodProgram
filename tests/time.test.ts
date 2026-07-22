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
