"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function createAccount(formData: FormData): Promise<void> {
  const db = supabaseServer();
  const { error } = await db.from("accounts").insert({
    label: str(formData, "label"),
    site: str(formData, "site"),
    login_id: str(formData, "login_id"),
    login_password: str(formData, "login_password"),
  });
  if (error) console.error("createAccount error", error);
  revalidatePath("/admin");
}

export async function updateAccount(formData: FormData): Promise<void> {
  const db = supabaseServer();
  const { error } = await db
    .from("accounts")
    .update({
      label: str(formData, "label"),
      site: str(formData, "site"),
      login_id: str(formData, "login_id"),
      login_password: str(formData, "login_password"),
    })
    .eq("id", str(formData, "id"));
  if (error) console.error("updateAccount error", error);
  revalidatePath("/admin");
}

export async function deleteAccount(formData: FormData): Promise<void> {
  const db = supabaseServer();
  const { error } = await db.from("accounts").delete().eq("id", str(formData, "id"));
  if (error) console.error("deleteAccount error", error);
  revalidatePath("/admin");
}

export async function createCourse(formData: FormData): Promise<void> {
  const db = supabaseServer();
  const { error } = await db.from("courses").insert({
    title: str(formData, "title"),
    category: str(formData, "category"),
    account_id: str(formData, "account_id"),
  });
  if (error) console.error("createCourse error", error);
  revalidatePath("/admin");
}

export async function updateCourse(formData: FormData): Promise<void> {
  const db = supabaseServer();
  const { error } = await db
    .from("courses")
    .update({
      title: str(formData, "title"),
      category: str(formData, "category"),
      account_id: str(formData, "account_id"),
    })
    .eq("id", str(formData, "id"));
  if (error) console.error("updateCourse error", error);
  revalidatePath("/admin");
}

export async function deleteCourse(formData: FormData): Promise<void> {
  const db = supabaseServer();
  const { error } = await db.from("courses").delete().eq("id", str(formData, "id"));
  if (error) console.error("deleteCourse error", error);
  revalidatePath("/admin");
}
