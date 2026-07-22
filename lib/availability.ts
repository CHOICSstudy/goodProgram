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
