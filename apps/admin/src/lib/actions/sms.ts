"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/lib/auth";
import { sendTemplatedSms } from "@eng/sms";

/**
 * Manually send the callback-reminder SMS to a lead. Triggered by staff
 * from the LeadDrawer's Communications section when a call goes unanswered.
 *
 * The funnel does all the heavy lifting (template lookup, allowlist check,
 * Eskiz call, SmsHistory write). This action just looks up the lead and
 * passes the right shape in, then revalidates /leads so the drawer's
 * SMS history refreshes.
 */
export async function sendCallbackReminder(leadId: string) {
  const admin = await requireAdmin();

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, firstName: true, phone: true, language: true, status: true },
  });
  if (!lead) return { error: "Lead not found" };

  // Only meaningful for active leads — a converted student is handled
  // through the student side, a lost lead shouldn't be re-pinged.
  if (lead.status !== "NEW" && lead.status !== "CONTACTED") {
    return { error: `Cannot send reminder to a ${lead.status} lead` };
  }

  const smsLanguage =
    lead.language === "uz" || lead.language === "ru" ? lead.language : "ru";

  const result = await sendTemplatedSms({
    recipient: {
      leadId: lead.id,
      phone: lead.phone,
      language: smsLanguage,
    },
    templateCode: "lead_callback_reminder",
    variables: { name: lead.firstName },
    sentById: admin.id,
  });

  revalidatePath("/leads");

  if (!result.ok) {
    return { error: result.reason };
  }
  return { success: true };
}
