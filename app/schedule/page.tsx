import { getMemberName } from "@/lib/member";
import { ScheduleGrid } from "@/components/schedule-grid";

export default async function SchedulePage() {
  const myName = (await getMemberName()) ?? "";
  return <ScheduleGrid myName={myName} />;
}
