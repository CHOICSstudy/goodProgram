import { supabaseServer } from "@/lib/supabase";
import {
  createAccount,
  updateAccount,
  deleteAccount,
  createCourse,
  updateCourse,
  deleteCourse,
} from "@/app/actions/admin-actions";

export const dynamic = "force-dynamic";

type AccountRow = {
  id: string;
  label: string;
  site: string;
  login_id: string;
  login_password: string;
};
type CourseRow = {
  id: string;
  title: string;
  category: string;
  account_id: string;
};

const inputCls = "rounded border px-2 py-1 text-sm";
const btnCls = "rounded bg-black px-3 py-1 text-sm text-white";
const delBtnCls = "rounded bg-red-100 px-3 py-1 text-sm";

export default async function AdminPage() {
  const db = supabaseServer();
  const [{ data: accounts }, { data: courses }] = await Promise.all([
    db
      .from("accounts")
      .select("id,label,site,login_id,login_password")
      .order("created_at"),
    db.from("courses").select("id,title,category,account_id").order("title"),
  ]);
  const accountRows = (accounts ?? []) as AccountRow[];
  const courseRows = (courses ?? []) as CourseRow[];
  const labelOf = (id: string) =>
    accountRows.find((a) => a.id === id)?.label ?? "?";

  return (
    <main className="mx-auto max-w-3xl p-6">
      <section className="mb-10">
        <h1 className="mb-3 text-lg font-bold">계정 관리</h1>
        <form action={createAccount} className="mb-4 flex flex-wrap gap-2">
          <input name="label" placeholder="라벨 (계정1)" required className={inputCls} />
          <input name="site" placeholder="사이트" required className={inputCls} />
          <input name="login_id" placeholder="아이디" required className={inputCls} />
          <input name="login_password" placeholder="비밀번호" required className={inputCls} />
          <button className={btnCls}>추가</button>
        </form>
        <ul className="flex flex-col gap-2">
          {accountRows.map((a) => (
            <li key={a.id} className="rounded border p-3">
              <details>
                <summary className="cursor-pointer text-sm">
                  <b>{a.label}</b> — {a.site} ({a.login_id})
                </summary>
                <form action={updateAccount} className="mt-2 flex flex-wrap gap-2">
                  <input type="hidden" name="id" value={a.id} />
                  <input name="label" defaultValue={a.label} required className={inputCls} />
                  <input name="site" defaultValue={a.site} required className={inputCls} />
                  <input name="login_id" defaultValue={a.login_id} required className={inputCls} />
                  <input name="login_password" defaultValue={a.login_password} required className={inputCls} />
                  <button className={btnCls}>수정</button>
                </form>
                <form action={deleteAccount} className="mt-2">
                  <input type="hidden" name="id" value={a.id} />
                  <button className={delBtnCls}>삭제 (묶인 인강·예약도 삭제됨)</button>
                </form>
              </details>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h1 className="mb-3 text-lg font-bold">인강 관리</h1>
        <form action={createCourse} className="mb-4 flex flex-wrap gap-2">
          <input name="title" placeholder="제목" required className={inputCls} />
          <input name="category" placeholder="카테고리 (backend)" required className={inputCls} />
          <select name="account_id" required className={inputCls}>
            {accountRows.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
          <button className={btnCls}>추가</button>
        </form>
        <ul className="flex flex-col gap-2">
          {courseRows.map((c) => (
            <li key={c.id} className="rounded border p-3">
              <details>
                <summary className="cursor-pointer text-sm">
                  <b>{c.title}</b> — {c.category} / {labelOf(c.account_id)}
                </summary>
                <form action={updateCourse} className="mt-2 flex flex-wrap gap-2">
                  <input type="hidden" name="id" value={c.id} />
                  <input name="title" defaultValue={c.title} required className={inputCls} />
                  <input name="category" defaultValue={c.category} required className={inputCls} />
                  <select name="account_id" defaultValue={c.account_id} required className={inputCls}>
                    {accountRows.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                  <button className={btnCls}>수정</button>
                </form>
                <form action={deleteCourse} className="mt-2">
                  <input type="hidden" name="id" value={c.id} />
                  <button className={delBtnCls}>삭제</button>
                </form>
              </details>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
