"use client";

import { useState } from "react";
import { checkIn, checkOut } from "@/app/actions/session-actions";

const CHECKOUT_OPTIONS = [
  { label: "미정 (2시간 후 자동)", minutes: null },
  { label: "30분 후", minutes: 30 },
  { label: "1시간 후", minutes: 60 },
  { label: "1시간 30분 후", minutes: 90 },
  { label: "2시간 후", minutes: 120 },
  { label: "3시간 후", minutes: 180 },
  { label: "4시간 후", minutes: 240 },
  { label: "5시간 후", minutes: 300 },
  { label: "6시간 후", minutes: 360 },
] as const;

const MAX_CUSTOM_HOURS = 10;

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
  const [customHours, setCustomHours] = useState("3");
  const [error, setError] = useState<string | null>(null);

  async function handleCheckIn() {
    let m: number | null;
    if (minutes === "null") {
      m = null;
    } else if (minutes === "custom") {
      const h = Number(customHours);
      if (!Number.isFinite(h) || h <= 0 || h > MAX_CUSTOM_HOURS) {
        setError(`직접 입력은 0.5~${MAX_CUSTOM_HOURS}시간 사이로 해주세요.`);
        return;
      }
      m = Math.round(h * 60);
    } else {
      m = Number(minutes);
    }
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
        <option value="custom">직접 입력</option>
      </select>
      {minutes === "custom" && (
        <span className="flex items-center gap-1 text-sm">
          <input
            type="number"
            min={0.5}
            max={MAX_CUSTOM_HOURS}
            step={0.5}
            value={customHours}
            onChange={(e) => setCustomHours(e.target.value)}
            className="w-16 rounded border px-1 py-1 text-sm"
          />
          시간 후
        </span>
      )}
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
