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
import { Label } from "@/components/ui/label";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Download, Plus, Trash2, X } from "lucide-react";
import {
  getDocumentUploadUrl,
  saveTeacherDocument,
  deleteTeacherDocument,
  getDocumentDownloadUrl,
} from "@/lib/actions/teacher-documents";
import type { TeacherDocumentRecord } from "@/lib/queries/teachers";

interface TeacherDocumentsSectionProps {
  teacherId: string;
  documents: TeacherDocumentRecord[];
}

export function TeacherDocumentsSection({
  teacherId,
  documents,
}: TeacherDocumentsSectionProps) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleClose() {
    setUploadOpen(false);
    setFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleUpload() {
    if (files.length === 0) return;

    startTransition(async () => {
      let uploaded = 0;
      let failed = 0;

      for (const file of files) {
        const urlResult = await getDocumentUploadUrl(
          teacherId,
          file.name,
          file.type,
        );
        if ("error" in urlResult) {
          toast.error(`${file.name}: ${urlResult.error}`);
          failed++;
          continue;
        }

        const response = await fetch(urlResult.url, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });

        if (!response.ok) {
          toast.error(`${file.name}: Failed to upload`);
          failed++;
          continue;
        }

        const saveResult = await saveTeacherDocument({
          teacherId,
          fileName: file.name,
          fileKey: urlResult.key,
          fileSize: file.size,
        });

        if (saveResult?.error) {
          toast.error(`${file.name}: ${saveResult.error}`);
          failed++;
        } else {
          uploaded++;
        }
      }

      if (uploaded > 0) {
        toast.success(
          `${uploaded} document${uploaded === 1 ? "" : "s"} uploaded`,
        );
      }
      if (failed === 0) {
        handleClose();
      }
    });
  }

  function handleDownload(docId: string) {
    startTransition(async () => {
      const result = await getDocumentDownloadUrl(docId);
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
        <h3 className="text-lg font-medium">Documents</h3>
        <Button variant="outline" size="sm" onClick={() => setUploadOpen(true)}>
          <Plus className="mr-1 size-3.5" />
          Upload
        </Button>
      </div>

      {documents.length === 0 ? (
        <p className="text-muted-foreground text-sm">No documents uploaded.</p>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="px-3 py-2 text-left font-medium">Name</th>
                <th className="px-3 py-2 text-left font-medium">Size</th>
                <th className="px-3 py-2 text-left font-medium">Uploaded</th>
                <th className="px-3 py-2 text-left font-medium">By</th>
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{doc.fileName}</td>
                  <td className="text-muted-foreground px-3 py-2">
                    {formatFileSize(doc.fileSize)}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {new Date(doc.uploadedAt).toLocaleDateString("en-GB")}
                  </td>
                  <td className="text-muted-foreground px-3 py-2">
                    {doc.uploadedBy.firstName} {doc.uploadedBy.lastName}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload(doc.id)}
                        disabled={isPending}
                      >
                        <Download className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(doc.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog
        open={uploadOpen}
        onOpenChange={(v) => {
          if (isPending) return;
          if (!v) handleClose();
          else setUploadOpen(true);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Documents</DialogTitle>
            <DialogDescription>
              Upload documents for this teacher. You can select multiple files.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Files</Label>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                className="hidden"
              />
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Choose Files
                </Button>
                <span className="text-muted-foreground text-sm">
                  {files.length === 0
                    ? "No files chosen"
                    : `${files.length} file${files.length === 1 ? "" : "s"} selected`}
                </span>
              </div>
              {files.length > 0 && (
                <ul className="text-muted-foreground space-y-1 text-sm">
                  {files.map((f, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span>
                        {f.name} ({formatFileSize(f.size)})
                      </span>
                      <button
                        type="button"
                        className="text-muted-foreground/60 hover:text-foreground"
                        onClick={() =>
                          setFiles(files.filter((_, j) => j !== i))
                        }
                      >
                        <X className="size-4 text-red-600" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-muted-foreground text-xs">
                PDF, JPEG, PNG, or WebP. Max 10 MB per file.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose} disabled={isPending}>
              Cancel
            </Button>
            <Button
              disabled={files.length === 0 || isPending}
              onClick={handleUpload}
            >
              {isPending
                ? "Uploading..."
                : `Upload${files.length > 1 ? ` (${files.length})` : ""}`}
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
        title="Delete Document"
        description="This will permanently remove the document. This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!deleteId) return;
          const result = await deleteTeacherDocument(deleteId);
          if (result?.error) {
            toast.error(result.error);
          } else {
            toast.success("Document deleted");
          }
          setDeleteId(null);
        }}
      />
    </div>
  );
}
