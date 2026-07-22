"use server";

import { supabaseServer } from "@/lib/supabase";
import { getMemberName } from "@/lib/member";

export async function createReservation(input: {
  accountId: string;
  courseId: string | null;
  startAt: string;
  endAt: string;
}): Promise<{ error?: string }> {
  const name = await getMemberName();
  if (!name) return { error: "이름을 먼저 선택하세요." };

  const db = supabaseServer();
  const { error } = await db.from("reservations").insert({
    account_id: input.accountId,
    course_id: input.courseId,
    member_name: name,
    start_at: input.startAt,
    end_at: input.endAt,
  });
  if (error?.code === "23P01") return { error: "이미 예약된 시간입니다." };
  if (error) return { error: "예약에 실패했습니다." };
  return {};
}

export async function cancelReservation(id: string): Promise<{ error?: string }> {
  const name = await getMemberName();
  if (!name) return { error: "이름을 먼저 선택하세요." };

  const db = supabaseServer();
  const { error } = await db
    .from("reservations")
    .delete()
    .eq("id", id)
    .eq("member_name", name);
  if (error) return { error: "취소에 실패했습니다." };
  return {};
}
