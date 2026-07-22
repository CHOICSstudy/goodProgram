import Link from "next/link";
import { getMemberName } from "@/lib/member";

export default async function Nav() {
  const name = await getMemberName();
  if (!name) return null;
  return (
    <nav className="flex items-center gap-4 border-b px-4 py-3">
      <Link href="/" className="font-bold">
        goodProgram
      </Link>
      <Link href="/">인강 목록</Link>
      <Link href="/schedule">시간표</Link>
      <Link href="/admin">관리</Link>
      <a
        href="/guide.html"
        className="ml-auto rounded border px-3 py-1 text-sm hover:bg-gray-50"
      >
        사용법
      </a>
      <span className="text-sm text-gray-500">
        {name}{" "}
        <Link href="/select-name" className="underline">
          변경
        </Link>
      </span>
    </nav>
  );
}
