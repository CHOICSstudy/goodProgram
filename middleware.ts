import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/login") return NextResponse.next();

  const token = req.cookies.get("team_session")?.value;
  const ok =
    !!token &&
    (await verifySessionToken(token, process.env.SESSION_SECRET!, new Date()));
  if (!ok) return NextResponse.redirect(new URL("/login", req.url));

  if (pathname !== "/select-name" && !req.cookies.get("member_name")?.value) {
    return NextResponse.redirect(new URL("/select-name", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|favicon.ico).*)"],
};
