"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { changeGroupTeacher } from "@/lib/actions/lessons";
import { getUzbekistanTodayStr } from "@/lib/helpers/date";
import { ArrowRightLeft } from "lucide-react";

interface TeacherChangeDialogProps {
  groupId: string;
  teachers: { id: string; firstName: string; lastName: string }[];
}

export function TeacherChangeDialog({
  groupId,
  teachers,
}: TeacherChangeDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(() => getUzbekistanTodayStr());
  const [isPending, startTransition] = useTransition();

  const todayStr = getUzbekistanTodayStr();
  const isFuture = effectiveDate > todayStr;

  function handleClose() {
    setOpen(false);
    setSelectedTeacherId("");
    setEffectiveDate(getUzbekistanTodayStr());
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <ArrowRightLeft className="mr-1 size-4" />
        Change Teacher
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Group Teacher</DialogTitle>
            <DialogDescription>
              Permanently reassign this group to a different teacher. All future scheduled lessons will be updated.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {teachers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No other active teachers available.
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">New Teacher</label>
                  <Select onValueChange={setSelectedTeacherId} value={selectedTeacherId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select new teacher..." />
                    </SelectTrigger>
                    <SelectContent>
                      {teachers.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.firstName} {t.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Effective Date</label>
                  <Input
                    type="date"
                    min={todayStr}
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              Close
            </Button>
            <Button
              disabled={!selectedTeacherId || !effectiveDate || isPending}
              onClick={() => {
                startTransition(async () => {
                  const result = await changeGroupTeacher({
                    groupId,
                    newTeacherId: selectedTeacherId,
                    effectiveDate,
                  }) as { error: string } | { success: true; scheduled?: boolean };
                  if ("error" in result) {
                    toast.error(result.error);
                  } else {
                    if (result.scheduled) {
                      toast.success("Teacher change scheduled");
                    } else {
                      toast.success("Teacher changed successfully");
                    }
                    handleClose();
                  }
                });
              }}
            >
              {isPending ? "Saving..." : isFuture ? "Schedule Change" : "Change Teacher"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
