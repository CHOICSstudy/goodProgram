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
