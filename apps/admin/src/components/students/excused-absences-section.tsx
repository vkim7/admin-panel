"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Download, Plus, Trash2, X } from "lucide-react";
import {
  createExcusedAbsence,
  deleteExcusedAbsence,
  getExcusedAbsenceUploadUrl,
  getExcusedAbsenceDocumentUrl,
} from "@/lib/actions/excused-absences";
import type { StudentExcusedAbsence } from "@/lib/queries/excused-absences";

interface ExcusedAbsencesSectionProps {
  studentId: string;
  excusedAbsences: StudentExcusedAbsence[];
  reasons: Array<{ id: string; name: string; isOther: boolean }>;
  eligibleLessons: Array<{
    lessonId: string;
    lessonDate: Date;
    startTime: string;
    groupPublicId: string;
    groupMembershipId: string;
  }>;
}

export function ExcusedAbsencesSection({
  studentId,
  excusedAbsences,
  reasons,
  eligibleLessons,
}: ExcusedAbsencesSectionProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Form state
  const [selectedLessonId, setSelectedLessonId] = useState("");
  const [selectedReasonId, setSelectedReasonId] = useState("");
  const [otherReason, setOtherReason] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedReason = reasons.find((r) => r.id === selectedReasonId);
  const selectedLesson = eligibleLessons.find(
    (l) => l.lessonId === selectedLessonId,
  );

  function resetForm() {
    setSelectedLessonId("");
    setSelectedReasonId("");
    setOtherReason("");
    setNote("");
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleClose() {
    setDialogOpen(false);
    resetForm();
  }

  function handleSubmit() {
    if (!selectedLessonId || !selectedReasonId || !selectedLesson) return;

    startTransition(async () => {
      let document: { fileName: string; fileKey: string; fileSize: number } | undefined;

      // Upload file if provided
      if (file) {
        if (file.size > 10 * 1024 * 1024) {
          toast.error("File too large. Maximum size is 10 MB.");
          return;
        }

        const urlResult = await getExcusedAbsenceUploadUrl(
          file.name,
          file.type,
          file.size,
        );
        if ("error" in urlResult) {
          toast.error(urlResult.error);
          return;
        }

        const response = await fetch(urlResult.url, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });

        if (!response.ok) {
          toast.error("Failed to upload document");
          return;
        }

        document = {
          fileName: file.name,
          fileKey: urlResult.key,
          fileSize: file.size,
        };
      }

      const result = await createExcusedAbsence(
        {
          studentId,
          lessonId: selectedLessonId,
          groupMembershipId: selectedLesson.groupMembershipId,
          reasonId: selectedReasonId,
          otherReason: selectedReason?.isOther ? otherReason : null,
          note: note || null,
        },
        document,
      );

      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Excused absence recorded");
        handleClose();
      }
    });
  }

  function handleDownload(id: string) {
    startTransition(async () => {
      const result = await getExcusedAbsenceDocumentUrl(id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      window.open(result.url, "_blank");
    });
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Excused Absences</h3>
        {eligibleLessons.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="mr-1 size-3.5" />
            Add
          </Button>
        )}
      </div>

      {excusedAbsences.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No excused absences recorded.
        </p>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2 text-left font-medium">Date</th>
                <th className="px-3 py-2 text-left font-medium">Group</th>
                <th className="px-3 py-2 text-left font-medium">Reason</th>
                <th className="px-3 py-2 text-left font-medium">Note</th>
                <th className="px-3 py-2 text-left font-medium">Doc</th>
                <th className="px-3 py-2 text-left font-medium">By</th>
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {excusedAbsences.map((ea) => (
                <tr key={ea.id} className="border-t">
                  <td className="px-3 py-2 tabular-nums">
                    {new Date(ea.lesson.lessonDate).toLocaleDateString("en-GB")}
                  </td>
                  <td className="px-3 py-2">{ea.lesson.group.publicId}</td>
                  <td className="px-3 py-2">
                    {ea.reason.isOther && ea.otherReason
                      ? ea.otherReason
                      : ea.reason.name}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground max-w-[200px] truncate">
                    {ea.note ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    {ea.documentFileKey ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload(ea.id)}
                        disabled={isPending}
                      >
                        <Download className="size-3.5" />
                      </Button>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {ea.createdBy.firstName} {ea.createdBy.lastName}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(ea.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(v) => {
          if (isPending) return;
          if (!v) handleClose();
          else setDialogOpen(true);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Excused Absence</DialogTitle>
            <DialogDescription>
              Record an excused absence for a completed lesson. This will reduce
              the student&apos;s bill and teacher&apos;s pay for that lesson.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Lesson selector */}
            <div className="space-y-2">
              <Label>Lesson</Label>
              <Select
                value={selectedLessonId}
                onValueChange={setSelectedLessonId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a lesson" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleLessons.map((l) => (
                    <SelectItem key={l.lessonId} value={l.lessonId}>
                      {l.groupPublicId} —{" "}
                      {new Date(l.lessonDate).toLocaleDateString("en-GB")}{" "}
                      {l.startTime}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Reason selector */}
            <div className="space-y-2">
              <Label>Reason</Label>
              <Select
                value={selectedReasonId}
                onValueChange={setSelectedReasonId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  {reasons.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Other reason (conditional) */}
            {selectedReason?.isOther && (
              <div className="space-y-2">
                <Label>Specify reason</Label>
                <Textarea
                  value={otherReason}
                  onChange={(e) => setOtherReason(e.target.value)}
                  placeholder="Describe the reason..."
                  rows={2}
                />
              </div>
            )}

            {/* Note */}
            <div className="space-y-2">
              <Label>
                Note{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Additional notes..."
                rows={2}
              />
            </div>

            {/* File upload */}
            <div className="space-y-2">
              <Label>
                Document{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Choose File
                </Button>
                <span className="text-sm text-muted-foreground">
                  {file ? (
                    <span className="flex items-center gap-1">
                      {file.name} ({formatFileSize(file.size)})
                      <button
                        type="button"
                        className="text-muted-foreground/60 hover:text-foreground"
                        onClick={() => {
                          setFile(null);
                          if (fileInputRef.current)
                            fileInputRef.current.value = "";
                        }}
                      >
                        <X className="size-4 text-red-600" />
                      </button>
                    </span>
                  ) : (
                    "No file chosen"
                  )}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                PDF, JPEG, PNG, or WebP. Max 10 MB.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              disabled={!selectedLessonId || !selectedReasonId || isPending}
              onClick={handleSubmit}
            >
              {isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmationDialog
        open={deleteId !== null}
        onOpenChange={(v) => {
          if (!v) setDeleteId(null);
        }}
        title="Remove Excused Absence"
        description="This will reverse the billing adjustment and restore the original lesson charge. This action cannot be undone."
        confirmLabel="Remove"
        onConfirm={async () => {
          if (!deleteId) return;
          const result = await deleteExcusedAbsence({ id: deleteId });
          if ("error" in result) {
            toast.error(result.error);
          } else {
            toast.success("Excused absence removed");
          }
          setDeleteId(null);
        }}
      />
    </div>
  );
}
