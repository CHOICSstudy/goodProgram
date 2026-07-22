"use client";

import { useActionState } from "react";
import { login } from "@/app/actions/auth-actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, null);
  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="mb-6 text-xl font-bold">팀 비밀번호를 입력하세요</h1>
      <form action={action} className="flex flex-col gap-3">
        <input
          type="password"
          name="password"
          required
          autoFocus
          className="rounded border px-3 py-2"
          placeholder="공용 비밀번호"
        />
        <button
          disabled={pending}
          className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
        >
          입장
        </button>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      </form>
    </main>
  );
}
