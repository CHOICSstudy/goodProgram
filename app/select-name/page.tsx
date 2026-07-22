import { MEMBERS } from "@/lib/members";
import { selectName } from "@/app/actions/auth-actions";

export default function SelectNamePage() {
  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="mb-6 text-xl font-bold">이름을 선택하세요</h1>
      <form action={selectName} className="flex flex-col gap-2">
        {MEMBERS.map((m) => (
          <button
            key={m}
            name="name"
            value={m}
            className="rounded border p-3 text-left hover:bg-gray-50"
          >
            {m}
          </button>
        ))}
      </form>
    </main>
  );
}
