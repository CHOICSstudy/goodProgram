"use server";

import { supabaseServer } from "@/lib/supabase";
import { getMemberName } from "@/lib/member";
import { findActiveSession } from "@/lib/availability";
import type { AccountWithCredentials, Session } from "@/lib/types";

export async function checkIn(
  accountId: string,
  plannedCheckoutAt: string | null,
): Promise<{ error?: string }> {
  const name = await getMemberName();
  if (!name) return { error: "이름을 먼저 선택하세요." };

  const db = supabaseServer();
  const now = new Date();
  const { data } = await db
    .from("sessions")
    .select("*")
    .eq("account_id", accountId)
    .is("checked_out_at", null);

  const active = findActiveSession((data ?? []) as Session[], accountId, now);
  if (active) return { error: `${active.member_name}님이 사용 중입니다.` };

  const { error } = await db.from("sessions").insert({
    account_id: accountId,
    member_name: name,
    planned_checkout_at: plannedCheckoutAt,
  });
  if (error) return { error: "체크인에 실패했습니다." };
  return {};
}

export async function checkOut(accountId: string): Promise<{ error?: string }> {
  const db = supabaseServer();
  const { error } = await db
    .from("sessions")
    .update({ checked_out_at: new Date().toISOString() })
    .eq("account_id", accountId)
    .is("checked_out_at", null);
  if (error) return { error: "체크아웃에 실패했습니다." };
  return {};
}

export async function getAccountCredentials(
  accountId: string,
): Promise<AccountWithCredentials | null> {
  const db = supabaseServer();
  const { data } = await db
    .from("accounts")
    .select("id,label,site,login_id,login_password")
    .eq("id", accountId)
    .maybeSingle();
  return data;
}
