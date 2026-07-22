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
