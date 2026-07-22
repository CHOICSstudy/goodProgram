const encoder = new TextEncoder();

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

async function hmacHex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createSessionToken(secret: string, now: Date): Promise<string> {
  const exp = now.getTime() + SESSION_TTL_MS;
  return `${exp}.${await hmacHex(secret, String(exp))}`;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifySessionToken(
  token: string,
  secret: string,
  now: Date,
): Promise<boolean> {
  const [expStr, sig] = token.split(".");
  if (!expStr || !sig) return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || now.getTime() >= exp) return false;
  return timingSafeEqual(sig, await hmacHex(secret, expStr));
}
