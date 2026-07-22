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
