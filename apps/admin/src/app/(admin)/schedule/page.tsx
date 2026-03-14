import { getScheduleData } from "@/lib/queries/schedule";
import { ScheduleGrid } from "@/components/schedule/schedule-grid";
import { PageHeader } from "@/components/ui/page-header";
import { Separator } from "@/components/ui/separator";

export default async function SchedulePage() {
  const schedule = await getScheduleData();

  return (
    <div className="space-y-8">
      <PageHeader title="Main Schedule" />
      <ScheduleGrid teachers={schedule.mwf} label="Mon / Wed / Fri" days="1,3,5" />
      <Separator />
      <ScheduleGrid teachers={schedule.tts} label="Tue / Thu / Sat" days="2,4,6" />
    </div>
  );
}
