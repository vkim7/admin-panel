import {
  getPendingResolutionLessons,
  getCancellationReasons,
  getAvailableSubstitutes,
} from "@/lib/queries/lessons";
import { PendingResolutionList } from "@/components/lessons/pending-resolution-list";
import { PageHeader } from "@/components/ui/page-header";

export default async function PendingLessonsPage() {
  const [lessons, cancellationReasons] = await Promise.all([
    getPendingResolutionLessons(),
    getCancellationReasons(),
  ]);

  // Pre-fetch available substitutes for each pending lesson
  const substitutesMap: Record<
    string,
    { id: string; firstName: string; lastName: string }[]
  > = {};

  await Promise.all(
    lessons.map(async (lesson) => {
      const subs = await getAvailableSubstitutes(
        lesson.lessonDate,
        lesson.startTime,
        lesson.group.durationMinutes,
        lesson.originalTeacher.id,
      );
      substitutesMap[lesson.id] = subs;
    }),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pending Lessons"
        breadcrumbs={[{ label: "Pending Lessons" }]}
      />
      <PendingResolutionList
        lessons={lessons}
        cancellationReasons={cancellationReasons}
        substitutesMap={substitutesMap}
      />
    </div>
  );
}
