"use client";

import { EditCommentDialog } from "@/components/shared/edit-comment-dialog";
import { updateStudentComment } from "@/lib/actions/students";

interface Props {
  studentId: string;
  currentComment: string | null;
}

export function StudentCommentEdit({ studentId, currentComment }: Props) {
  return (
    <EditCommentDialog
      currentComment={currentComment}
      onSave={(comment) => updateStudentComment(studentId, comment)}
      title="Edit Comment"
    />
  );
}
