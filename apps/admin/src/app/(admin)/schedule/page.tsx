import { getScheduleData } from "@/lib/queries/schedule";
import { ScheduleWithFilters } from "@/components/schedule/schedule-filters";

export default async function SchedulePage() {
  const schedule = await getScheduleData();

  return <ScheduleWithFilters mwf={schedule.mwf} tts={schedule.tts} />;
}
