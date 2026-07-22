import { cookies } from "next/headers";

export async function getMemberName(): Promise<string | null> {
  const raw = (await cookies()).get("member_name")?.value;
  return raw ? decodeURIComponent(raw) : null;
}
