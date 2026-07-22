"use client";

import { useEffect, useState } from "react";
import { getAccountCredentials } from "@/app/actions/session-actions";
import type { AccountWithCredentials } from "@/lib/types";
import { CheckinControls } from "./checkin-controls";

function CredRow({
  label,
  value,
  masked,
  onToggle,
}: {
  label: string;
  value: string;
  masked?: boolean;
  onToggle?: () => void;
}) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="w-16 shrink-0 text-sm text-gray-500">{label}</span>
      <code className="flex-1 overflow-x-auto rounded bg-gray-100 px-2 py-1 text-sm">
        {masked ? "••••••••" : value}
      </code>
      {onToggle && (
        <button onClick={onToggle} className="shrink-0 text-sm underline">
          {masked ? "보기" : "숨기기"}
        </button>
      )}
      <button
        onClick={() => navigator.clipboard.writeText(value)}
        className="shrink-0 text-sm underline"
      >
        복사
      </button>
    </div>
  );
}

export function AccountModal({
  accountId,
  active,
  onClose,
  onChanged,
}: {
  accountId: string;
  active: { member_name: string } | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [creds, setCreds] = useState<AccountWithCredentials | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    getAccountCredentials(accountId).then(setCreds);
  }, [accountId]);

  return (
    <div
      className="fixed inset-0 z-10 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {creds ? (
          <>
            <h2 className="mb-1 text-lg font-bold">{creds.label}</h2>
            <p className="mb-4 text-sm text-gray-600">
              {creds.site} 에 아래 계정으로 로그인하세요.
            </p>
            <CredRow label="아이디" value={creds.login_id} />
            <CredRow
              label="비밀번호"
              value={creds.login_password}
              masked={!show}
              onToggle={() => setShow((s) => !s)}
            />
            <div className="mt-4">
              <CheckinControls
                accountId={accountId}
                active={active}
                onChanged={onChanged}
              />
            </div>
          </>
        ) : (
          <p>불러오는 중…</p>
        )}
        <button onClick={onClose} className="mt-4 text-sm underline">
          닫기
        </button>
      </div>
    </div>
  );
}
