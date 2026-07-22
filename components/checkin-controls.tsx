"use client";

import { useState } from "react";
import { checkIn, checkOut } from "@/app/actions/session-actions";

const CHECKOUT_OPTIONS = [
  { label: "미정 (2시간 후 자동)", minutes: null },
  { label: "30분 후", minutes: 30 },
  { label: "1시간 후", minutes: 60 },
  { label: "1시간 30분 후", minutes: 90 },
  { label: "2시간 후", minutes: 120 },
] as const;

export function CheckinControls({
  accountId,
  active,
  onChanged,
}: {
  accountId: string;
  active: { member_name: string } | null;
  onChanged: () => void;
}) {
  const [minutes, setMinutes] = useState("null");
  const [error, setError] = useState<string | null>(null);

  async function handleCheckIn() {
    const m = minutes === "null" ? null : Number(minutes);
    const planned = m ? new Date(Date.now() + m * 60_000).toISOString() : null;
    const res = await checkIn(accountId, planned);
    setError(res.error ?? null);
    onChanged();
  }

  async function handleCheckOut() {
    const res = await checkOut(accountId);
    setError(res.error ?? null);
    onChanged();
  }

  if (active) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={handleCheckOut}
          className="rounded bg-red-100 px-2 py-1 text-sm"
        >
          사용 종료
        </button>
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={minutes}
        onChange={(e) => setMinutes(e.target.value)}
        className="rounded border px-1 py-1 text-sm"
      >
        {CHECKOUT_OPTIONS.map((o) => (
          <option key={o.label} value={String(o.minutes)}>
            {o.label}
          </option>
        ))}
      </select>
      <button
        onClick={handleCheckIn}
        className="rounded bg-green-100 px-2 py-1 text-sm"
      >
        사용 시작
      </button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  );
}
