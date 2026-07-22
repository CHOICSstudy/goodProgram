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
