"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase";
import { createSessionToken, SESSION_TTL_MS } from "@/lib/auth";
import { isLocked, nextStateOnFailure } from "@/lib/rate-limit";

export async function login(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string }> {
  const password = formData.get("password");
  const ip =
    (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const db = supabaseServer();
  const now = new Date();

  const { data: attempt } = await db
    .from("login_attempts")
    .select("fail_count, locked_until")
    .eq("ip", ip)
    .maybeSingle();

  if (isLocked(attempt, now)) {
    return { error: "시도 횟수를 초과했습니다. 1분 후 다시 시도하세요." };
  }

  if (password !== process.env.TEAM_PASSWORD) {
    const next = nextStateOnFailure(attempt, now);
    await db
      .from("login_attempts")
      .upsert({ ip, ...next, updated_at: now.toISOString() });
    return {
      error: next.locked_until
        ? "5회 연속 실패로 1분간 잠깁니다."
        : "비밀번호가 틀렸습니다.",
    };
  }

  await db.from("login_attempts").delete().eq("ip", ip);
  const token = await createSessionToken(process.env.SESSION_SECRET!, now);
  (await cookies()).set("team_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
  redirect("/select-name");
}

export async function selectName(formData: FormData): Promise<void> {
  const { MEMBERS } = await import("@/lib/members");
  const name = String(formData.get("name"));
  if (!MEMBERS.includes(name)) return;
  (await cookies()).set("member_name", encodeURIComponent(name), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
  redirect("/");
}
