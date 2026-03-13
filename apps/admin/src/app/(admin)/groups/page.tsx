import Link from "next/link";
import { getGroups } from "@/lib/queries/groups";
import { getProgressStage } from "@/lib/helpers/lesson-generation";
import { GroupTable } from "@/components/groups/group-table";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default async function GroupsPage() {
  const groups = await getGroups();

  const groupsWithStage = groups.map((g) => ({
    ...g,
    progressStage: getProgressStage(g.startDate, g.endDate),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Groups"
        actions={
          <Button asChild>
            <Link href="/groups/new">
              <Plus className="mr-1 size-4" />
              Create Group
            </Link>
          </Button>
        }
      />
      <GroupTable data={groupsWithStage} />
    </div>
  );
}
