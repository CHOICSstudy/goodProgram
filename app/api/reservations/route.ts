import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get("accountId");
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  if (!accountId || !start || !end) {
    return NextResponse.json({ error: "missing params" }, { status: 400 });
  }

  const db = supabaseServer();
  const { data, error } = await db
    .from("reservations")
    .select("id,course_id,account_id,member_name,start_at,end_at")
    .eq("account_id", accountId)
    .lt("start_at", end)
    .gt("end_at", start)
    .order("start_at");

  if (error) {
    console.error("reservations query error", error);
  }

  return NextResponse.json({ reservations: data ?? [] });
}
