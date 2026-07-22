"use client";

import { useState } from "react";
import { usePolling } from "@/lib/use-polling";
import type { Reservation, StatusPayload } from "@/lib/types";
import { CheckinControls } from "./checkin-controls";
import { AccountModal } from "./account-modal";

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function nextTodayReservation(
  reservations: Reservation[],
  accountId: string,
): Reservation | null {
  const now = Date.now();
  return (
    reservations.find(
      (r) => r.account_id === accountId && new Date(r.end_at).getTime() > now,
    ) ?? null
  );
}

export function CourseList() {
  const { data, refresh } = usePolling<StatusPayload>("/api/status");
  const [category, setCategory] = useState("전체");
  const [query, setQuery] = useState("");
  const [modalAccountId, setModalAccountId] = useState<string | null>(null);

  if (!data) return <p className="p-8">불러오는 중…</p>;

  const categories = [
    "전체",
    ...Array.from(new Set(data.courses.map((c) => c.category))),
  ];
  const courses = data.courses.filter(
    (c) =>
      (category === "전체" || c.category === category) &&
      c.title.includes(query),
  );
  const accountOf = (id: string) => data.accounts.find((a) => a.id === id);
  const modalAccount = modalAccountId ? accountOf(modalAccountId) : null;

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`rounded-full border px-3 py-1 text-sm ${
              category === c ? "bg-black text-white" : "hover:bg-gray-50"
            }`}
          >
            {c}
          </button>
        ))}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="제목 검색"
          className="ml-auto rounded border px-3 py-1 text-sm"
        />
      </div>

      <ul className="flex flex-col gap-3">
        {courses.map((course) => {
          const account = accountOf(course.account_id);
          if (!account) return null;
          const active = account.activeSession;
          const nextRes = nextTodayReservation(
            data.todayReservations,
            account.id,
          );
          return (
            <li key={course.id} className="rounded border p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="font-bold">{course.title}</span>
                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs">
                  {course.category}
                </span>
                <span className="text-sm text-gray-500">{account.label}</span>
                {active ? (
                  <span className="ml-auto rounded bg-red-100 px-2 py-0.5 text-sm">
                    🔴 {active.member_name} 사용 중 (~
                    {fmtTime(active.effective_checkout_at)})
                  </span>
                ) : (
                  <span className="ml-auto rounded bg-green-100 px-2 py-0.5 text-sm">
                    🟢 사용 가능
                  </span>
                )}
              </div>
              {nextRes && (
                <p className="mb-2 text-sm text-gray-600">
                  다음 예약: {nextRes.member_name} {fmtTime(nextRes.start_at)}~
                  {fmtTime(nextRes.end_at)}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <CheckinControls
                  accountId={account.id}
                  active={active}
                  onChanged={refresh}
                />
                <button
                  onClick={() => setModalAccountId(account.id)}
                  className="text-sm underline"
                >
                  계정 확인하기
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {modalAccountId && (
        <AccountModal
          accountId={modalAccountId}
          active={modalAccount?.activeSession ?? null}
          onClose={() => setModalAccountId(null)}
          onChanged={refresh}
        />
      )}
    </main>
  );
}
