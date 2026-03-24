import Link from "next/link";
import { UserPlus } from "lucide-react";
import { getReceptionStudents, getGroupsForAssignment, getFirstLessonsData, getSecondLessonsData } from "@/lib/queries/reception";
import { getLostReasons } from "@/lib/queries/students";
import { getGroupsForTransfer } from "@/lib/queries/transfers";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { ReceptionView } from "@/components/reception/reception-view";

export default async function ReceptionPage() {
  const [students, groups, firstLessons, secondLessons, lostReasons, transferGroups] = await Promise.all([
    getReceptionStudents(),
    getGroupsForAssignment(),
    getFirstLessonsData(),
    getSecondLessonsData(),
    getLostReasons(),
    getGroupsForTransfer(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reception"
        breadcrumbs={[{ label: "Reception" }]}
        actions={
          <Button asChild size="sm">
            <Link href="/students/new?returnTo=/reception">
              <UserPlus className="mr-2 size-4" />
              Add Student
            </Link>
          </Button>
        }
      />
      <ReceptionView
        students={students}
        groups={groups}
        firstLessons={firstLessons}
        secondLessons={secondLessons}
        lostReasons={lostReasons}
        transferGroups={transferGroups}
      />
    </div>
  );
}
