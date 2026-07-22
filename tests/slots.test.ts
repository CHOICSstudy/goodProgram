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
