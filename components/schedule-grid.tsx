"use client";

import { useState } from "react";
import { usePolling } from "@/lib/use-polling";
import type { Reservation, StatusPayload } from "@/lib/types";
import { weekStart, addDays, slotTimes, slotRange } from "@/lib/slots";
import {
  createReservation,
  cancelReservation,
} from "@/app/actions/reservation-actions";

const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

export function ScheduleGrid({ myName }: { myName: string }) {
  const { data: status } = usePolling<StatusPayload>("/api/status");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [pending, setPending] = useState<{ start: Date; end: Date } | null>(null);
  const [courseId, setCourseId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [drag, setDrag] = useState<{ day: number; a: number; b: number } | null>(
    null,
  );

  const start = weekStart(new Date());
  const end = addDays(start, 7);
  const url = accountId
    ? `/api/reservations?accountId=${accountId}&start=${start.toISOString()}&end=${end.toISOString()}`
    : null;
  const { data: resData, refresh } = usePolling<{ reservations: Reservation[] }>(url);
  const reservations = resData?.reservations ?? [];

  if (!status) return <p className="p-8">불러오는 중…</p>;
  const selected = accountId ?? status.accounts[0]?.id ?? null;
  if (accountId === null && selected) setAccountId(selected);

  const accountCourses = status.courses.filter((c) => c.account_id === selected);

  function findReservation(slotStart: Date, slotEnd: Date): Reservation | null {
    return (
      reservations.find(
        (r) =>
          new Date(r.start_at) < slotEnd && new Date(r.end_at) > slotStart,
      ) ?? null
    );
  }

  async function handleReserve() {
    if (!pending || !selected) return;
    const res = await createReservation({
      accountId: selected,
      courseId: courseId || null,
      startAt: pending.start.toISOString(),
      endAt: pending.end.toISOString(),
    });
    setError(res.error ?? null);
    setPending(null);
    setCourseId("");
    refresh();
  }

  const slots = slotTimes();

  // [a..b] 범위(같은 요일)에 기존 예약이 없는지
  function rangeFree(dayIdx: number, a: number, b: number): boolean {
    const day = addDays(start, dayIdx);
    const [lo, hi] = [Math.min(a, b), Math.max(a, b)];
    for (let i = lo; i <= hi; i++) {
      const rg = slotRange(day, slots[i]);
      if (findReservation(rg.start, rg.end)) return false;
    }
    return true;
  }

  function dragStart(dayIdx: number, slotIdx: number) {
    setDrag({ day: dayIdx, a: slotIdx, b: slotIdx });
  }

  function dragOver(dayIdx: number, slotIdx: number) {
    setDrag((d) =>
      d && d.day === dayIdx && rangeFree(dayIdx, d.a, slotIdx)
        ? { ...d, b: slotIdx }
        : d,
    );
  }

  function dragEnd() {
    if (!drag) return;
    const [lo, hi] = [Math.min(drag.a, drag.b), Math.max(drag.a, drag.b)];
    const day = addDays(start, drag.day);
    setPending({
      start: slotRange(day, slots[lo]).start,
      end: slotRange(day, slots[hi]).end,
    });
    setDrag(null);
  }

  function inDrag(dayIdx: number, slotIdx: number): boolean {
    if (!drag || drag.day !== dayIdx) return false;
    const [lo, hi] = [Math.min(drag.a, drag.b), Math.max(drag.a, drag.b)];
    return slotIdx >= lo && slotIdx <= hi;
  }

  async function handleCancel(r: Reservation) {
    if (r.member_name !== myName) return;
    if (!window.confirm("이 예약을 취소할까요?")) return;
    const res = await cancelReservation(r.id);
    setError(res.error ?? null);
    refresh();
  }

  return (
    <main className="flex gap-4 p-4">
      <aside className="w-56 shrink-0">
        <h2 className="mb-2 font-bold">계정</h2>
        <ul className="flex flex-col gap-1">
          {status.accounts.map((a) => {
            const courses = status.courses.filter((c) => c.account_id === a.id);
            const isCollapsed = collapsed[a.id] ?? false;
            return (
              <li key={a.id} className="rounded border">
                <div
                  className={`flex items-center rounded ${
                    selected === a.id ? "bg-black text-white" : "hover:bg-gray-50"
                  }`}
                >
                  <button
                    onClick={() => setAccountId(a.id)}
                    className="grow px-2 py-2 text-left text-sm"
                  >
                    {a.label}
                    {a.activeSession && (
                      <span className="block text-xs">
                        🔴 {a.activeSession.member_name}
                      </span>
                    )}
                  </button>
                  {courses.length > 0 && (
                    <button
                      onClick={() =>
                        setCollapsed((c) => ({ ...c, [a.id]: !isCollapsed }))
                      }
                      className="shrink-0 px-2 py-2 text-xs"
                      title={isCollapsed ? "인강 목록 펼치기" : "인강 목록 접기"}
                    >
                      {isCollapsed ? "▸" : "▾"}
                    </button>
                  )}
                </div>
                {!isCollapsed && courses.length > 0 && (
                  <ul className="px-2 pb-2 pt-1">
                    {courses.map((c) => (
                      <li
                        key={c.id}
                        className="truncate text-xs text-gray-500"
                        title={c.title}
                      >
                        · {c.title}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </aside>

      <div
        className="grow select-none overflow-x-auto"
        onMouseUp={dragEnd}
        onMouseLeave={() => setDrag(null)}
      >
        {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
        <p className="mb-1 text-xs text-gray-400">
          빈 칸을 클릭하거나 아래로 드래그해서 원하는 시간만큼 예약하세요.
        </p>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="w-14 border p-1"></th>
              {DAY_LABELS.map((d, i) => (
                <th key={d} className="border p-1">
                  {d} {addDays(start, i).getDate()}일
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slots.map((label, slotIdx) => (
              <tr key={label}>
                <td className="border p-1 text-right text-gray-500">{label}</td>
                {DAY_LABELS.map((_, i) => {
                  const day = addDays(start, i);
                  const range = slotRange(day, label);
                  const r = findReservation(range.start, range.end);
                  if (r) {
                    return (
                      <td
                        key={i}
                        onClick={() => handleCancel(r)}
                        className={`border bg-green-200 p-1 text-center ${
                          r.member_name === myName ? "cursor-pointer" : ""
                        }`}
                        title={r.member_name === myName ? "클릭하여 취소" : ""}
                      >
                        {r.member_name}
                      </td>
                    );
                  }
                  return (
                    <td
                      key={i}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        dragStart(i, slotIdx);
                      }}
                      onMouseEnter={() => dragOver(i, slotIdx)}
                      className={`cursor-pointer border p-1 ${
                        inDrag(i, slotIdx)
                          ? "bg-blue-200"
                          : "bg-white hover:bg-gray-100"
                      }`}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pending && (
        <div
          className="fixed inset-0 z-10 flex items-center justify-center bg-black/40"
          onClick={() => setPending(null)}
        >
          <div
            className="w-full max-w-sm rounded bg-white p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-3 font-bold">
              {pending.start.getMonth() + 1}/{pending.start.getDate()}{" "}
              {String(pending.start.getHours()).padStart(2, "0")}:
              {String(pending.start.getMinutes()).padStart(2, "0")}
              {" ~ "}
              {String(pending.end.getHours()).padStart(2, "0")}:
              {String(pending.end.getMinutes()).padStart(2, "0")} 예약
            </h2>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="mb-3 w-full rounded border px-2 py-1 text-sm"
            >
              <option value="">인강 선택 안 함</option>
              {accountCourses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={handleReserve}
                className="rounded bg-black px-3 py-1 text-sm text-white"
              >
                예약
              </button>
              <button
                onClick={() => setPending(null)}
                className="rounded border px-3 py-1 text-sm"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
