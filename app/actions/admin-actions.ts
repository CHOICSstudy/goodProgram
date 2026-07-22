"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function createAccount(formData: FormData): Promise<void> {
  const db = supabaseServer();
  await db.from("accounts").insert({
    label: str(formData, "label"),
    site: str(formData, "site"),
    login_id: str(formData, "login_id"),
    login_password: str(formData, "login_password"),
  });
  revalidatePath("/admin");
}

export async function updateAccount(formData: FormData): Promise<void> {
  const db = supabaseServer();
  await db
    .from("accounts")
    .update({
      label: str(formData, "label"),
      site: str(formData, "site"),
      login_id: str(formData, "login_id"),
      login_password: str(formData, "login_password"),
    })
    .eq("id", str(formData, "id"));
  revalidatePath("/admin");
}

export async function deleteAccount(formData: FormData): Promise<void> {
  const db = supabaseServer();
  await db.from("accounts").delete().eq("id", str(formData, "id"));
  revalidatePath("/admin");
}

export async function createCourse(formData: FormData): Promise<void> {
  const db = supabaseServer();
  await db.from("courses").insert({
    title: str(formData, "title"),
    category: str(formData, "category"),
    account_id: str(formData, "account_id"),
  });
  revalidatePath("/admin");
}

export async function updateCourse(formData: FormData): Promise<void> {
  const db = supabaseServer();
  await db
    .from("courses")
    .update({
      title: str(formData, "title"),
      category: str(formData, "category"),
      account_id: str(formData, "account_id"),
    })
    .eq("id", str(formData, "id"));
  revalidatePath("/admin");
}

export async function deleteCourse(formData: FormData): Promise<void> {
  const db = supabaseServer();
  await db.from("courses").delete().eq("id", str(formData, "id"));
  revalidatePath("/admin");
}
