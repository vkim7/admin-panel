import type { ScheduledAction } from "@eng/database";
import { prisma } from "@/server/db";
import { executeTransfer } from "@/lib/helpers/execute-transfer";
import { executeReassignment } from "@/lib/helpers/execute-reassignment";
import { executeSendToLost } from "@/lib/helpers/execute-send-to-lost";
import { executeMerge } from "@/lib/helpers/execute-merge";
import { executeAssign } from "@/lib/helpers/execute-assign";
import { executeChangeTeacher } from "@/lib/helpers/execute-change-teacher";

interface TransferPayload {
  transferReasonId: string;
  otherTransferReason: string | null;
}

interface SendToLostPayload {
  lostReasonId: string;
  otherLostReason: string | null;
}

interface AssignPayload {
  comment: string | null;
}

interface ChangeTeacherPayload {
  newTeacherId: string;
  currentTeacherName: string;
  newTeacherName: string;
}

/**
 * Execute a single scheduled action by dispatching to the appropriate core logic.
 * Used by both the cron handler and "Execute Now" server action.
 *
 * On success: marks COMPLETED + sets executedAt.
 * On business error: marks FAILED + sets failureReason.
 * Unexpected throws propagate to the caller.
 */
export async function executeSingleScheduledAction(
  action: ScheduledAction,
  adminIdOverride?: string,
): Promise<{ success: true; revalidatePaths: string[] } | { error: string }> {
  const adminId = adminIdOverride ?? action.createdById;
  const effectiveDate = action.effectiveDate;

  let result: { error: string } | { success: true; revalidatePaths: string[] };

  switch (action.type) {
    case "TRANSFER": {
      if (!action.membershipId || !action.destGroupId) {
        result = { error: "Missing membershipId or destinationGroupId for transfer" };
        break;
      }
      const payload = action.payload as unknown as TransferPayload;
      const transferResult = await executeTransfer({
        membershipId: action.membershipId,
        destinationGroupId: action.destGroupId,
        transferReasonId: payload.transferReasonId,
        otherTransferReason: payload.otherTransferReason,
        adminId,
        effectiveDate,
      });
      if ("error" in transferResult) {
        result = { error: transferResult.error };
      } else {
        result = { success: true, revalidatePaths: transferResult.revalidatePaths };
      }
      break;
    }

    case "SEND_TO_REASSIGNMENT": {
      if (!action.studentId) {
        result = { error: "Missing studentId for reassignment" };
        break;
      }
      const reassignResult = await executeReassignment({
        studentId: action.studentId,
        membershipId: action.membershipId ?? undefined,
        adminId,
        effectiveDate,
      });
      if ("error" in reassignResult) {
        result = { error: reassignResult.error };
      } else {
        result = { success: true, revalidatePaths: reassignResult.revalidatePaths };
      }
      break;
    }

    case "SEND_TO_LOST": {
      if (!action.studentId || !action.membershipId) {
        result = { error: "Missing studentId or membershipId for send to lost" };
        break;
      }
      const payload = action.payload as unknown as SendToLostPayload;
      const lostResult = await executeSendToLost({
        studentId: action.studentId,
        membershipId: action.membershipId,
        lostReasonId: payload.lostReasonId,
        otherLostReason: payload.otherLostReason,
        adminId,
        effectiveDate,
      });
      if ("error" in lostResult) {
        result = { error: lostResult.error };
      } else {
        result = { success: true, revalidatePaths: lostResult.revalidatePaths };
      }
      break;
    }

    case "MERGE_GROUP": {
      if (!action.sourceGroupId || !action.destGroupId) {
        result = { error: "Missing sourceGroupId or destinationGroupId for merge" };
        break;
      }
      const mergeResult = await executeMerge({
        sourceGroupId: action.sourceGroupId,
        destinationGroupId: action.destGroupId,
        adminId,
        effectiveDate,
      });
      if ("error" in mergeResult) {
        result = { error: mergeResult.error };
      } else {
        result = { success: true, revalidatePaths: mergeResult.revalidatePaths };
      }
      break;
    }

    case "ASSIGN": {
      if (!action.studentId || !action.destGroupId) {
        result = { error: "Missing studentId or destinationGroupId for assignment" };
        break;
      }
      const assignPayload = action.payload as unknown as AssignPayload;
      const assignResult = await executeAssign({
        groupId: action.destGroupId,
        studentIds: [action.studentId],
        joinDate: effectiveDate,
        comment: assignPayload.comment,
        adminId,
      });
      if ("error" in assignResult) {
        result = { error: assignResult.error };
      } else {
        result = { success: true, revalidatePaths: assignResult.revalidatePaths };
      }
      break;
    }

    case "CHANGE_TEACHER": {
      if (!action.sourceGroupId) {
        result = { error: "Missing sourceGroupId for teacher change" };
        break;
      }
      const changeTeacherPayload = action.payload as unknown as ChangeTeacherPayload;
      const changeTeacherResult = await executeChangeTeacher({
        groupId: action.sourceGroupId,
        newTeacherId: changeTeacherPayload.newTeacherId,
        effectiveDate,
        adminId,
      });
      if ("error" in changeTeacherResult) {
        result = { error: changeTeacherResult.error };
      } else {
        result = { success: true, revalidatePaths: changeTeacherResult.revalidatePaths };
      }
      break;
    }

    default:
      result = { error: `Unknown scheduled action type: ${action.type}` };
  }

  // Update action status based on result
  if ("error" in result) {
    await prisma.scheduledAction.update({
      where: { id: action.id },
      data: {
        status: "FAILED",
        failureReason: result.error,
        executedAt: new Date(),
      },
    });
  } else {
    await prisma.scheduledAction.update({
      where: { id: action.id },
      data: {
        status: "COMPLETED",
        executedAt: new Date(),
      },
    });
  }

  return result;
}
