import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { getUzbekistanToday } from "@/lib/helpers/date";
import { executeSingleScheduledAction } from "@/lib/helpers/execute-scheduled-action";

export async function GET(request: Request) {
  // Verify CRON_SECRET
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = getUzbekistanToday();

  // Query all PENDING actions due today or earlier
  const pendingActions = await prisma.scheduledAction.findMany({
    where: {
      status: "PENDING",
      effectiveDate: { lte: today },
    },
    orderBy: { effectiveDate: "asc" },
  });

  const results: { id: string; type: string; status: "completed" | "failed"; error?: string }[] = [];

  for (const action of pendingActions) {
    try {
      const result = await executeSingleScheduledAction(action);

      if ("error" in result) {
        results.push({ id: action.id, type: action.type, status: "failed", error: result.error });
      } else {
        for (const path of result.revalidatePaths) revalidatePath(path);
        results.push({ id: action.id, type: action.type, status: "completed" });
      }
    } catch (e) {
      // Unexpected error — mark as FAILED
      const errorMessage = e instanceof Error ? e.message : "Unknown error";
      await prisma.scheduledAction.update({
        where: { id: action.id },
        data: {
          status: "FAILED",
          failureReason: errorMessage,
          executedAt: new Date(),
        },
      });
      results.push({ id: action.id, type: action.type, status: "failed", error: errorMessage });
    }
  }

  if (results.length > 0) {
    revalidatePath("/scheduled-actions");
  }

  return NextResponse.json({
    processed: results.length,
    results,
  });
}
