"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { LeadDrawerHeader } from "./lead-drawer-header";
import { LeadDrawerNote } from "./lead-drawer-note";
import { LeadActivityFeed } from "./lead-activity-feed";
import { LeadPreferences } from "./lead-preferences";
import { LeadConvertButton } from "./lead-convert-button";
import { LeadCallbackSection } from "./lead-callback-section";
import { LeadTestSection } from "./lead-test-section";
import { SmsHistoryList } from "@/components/sms/sms-history-list";
import { SendCallbackReminderButton } from "@/components/sms/send-callback-reminder-button";
import type { SmsHistoryRow } from "@/lib/queries/sms";
import { getUrgencyInfo } from "@/lib/helpers/lead-staleness";
import type {
  LeadStatus,
  LessonPreference,
  PreferredLanguage,
  SelfAssessedLevel,
  LeadActivityType,
  Level,
} from "@eng/database";

export type LeadDrawerDetail = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  dateOfBirth: Date | null;
  language: string;
  lessonPreference: LessonPreference | null;
  selfAssessedLevel: SelfAssessedLevel | null;
  status: LeadStatus;
  adminNote: string | null;
  preferredDays: number[];
  preferredDaysAny: boolean;
  preferredTimeSlots: string[];
  preferredTimeSlotsAny: boolean;
  preferredLanguage: PreferredLanguage | null;
  testSentAt: Date | null;
  testLevelSent: Level | null;
  testScore: number | null;
  testScoredAt: Date | null;
  nextCallbackAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  activities: {
    id: string;
    type: LeadActivityType;
    metadata: unknown;
    createdAt: Date;
    actor: { id: string; firstName: string; lastName: string } | null;
  }[];
  smsHistory: SmsHistoryRow[];
};

/**
 * Controlled drawer — open state and detail data both come from the parent.
 * After every in-drawer mutation, sub-components call `onChange()` so the
 * parent can refetch fresh detail + the visible tab data.
 */
export function LeadDrawer({
  detail,
  onClose,
  onChange,
}: {
  detail: LeadDrawerDetail | null;
  onClose: () => void;
  onChange: () => Promise<void> | void;
}) {
  const isOpen = !!detail;

  const showConvert =
    detail !== null &&
    detail.status !== "LOST" &&
    detail.status !== "CONVERTED";

  return (
    <Sheet open={isOpen} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 flex flex-col gap-0"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>
            {detail ? `${detail.firstName} ${detail.lastName}` : "Lead"}
          </SheetTitle>
        </SheetHeader>

        {detail && (
          <>
            <LeadDrawerHeader
              leadId={detail.id}
              firstName={detail.firstName}
              lastName={detail.lastName}
              phone={detail.phone}
              language={detail.language}
              lessonPreference={detail.lessonPreference}
              selfAssessedLevel={detail.selfAssessedLevel}
              status={detail.status}
              urgency={getUrgencyInfo(detail)}
              onChange={onChange}
            />

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/40">
              <LeadPreferences
                leadId={detail.id}
                preferredDays={detail.preferredDays}
                preferredDaysAny={detail.preferredDaysAny}
                preferredTimeSlots={detail.preferredTimeSlots}
                preferredTimeSlotsAny={detail.preferredTimeSlotsAny}
                lessonPreference={detail.lessonPreference}
                preferredLanguage={detail.preferredLanguage}
                selfAssessedLevel={detail.selfAssessedLevel}
                dateOfBirth={detail.dateOfBirth}
                adminNote={detail.adminNote}
                formLanguage={detail.language}
                status={detail.status}
                onChange={onChange}
              />

              <LeadCallbackSection
                leadId={detail.id}
                nextCallbackAt={detail.nextCallbackAt}
                onChange={onChange}
              />

              <LeadTestSection
                leadId={detail.id}
                testSentAt={detail.testSentAt}
                testLevelSent={detail.testLevelSent}
                testScore={detail.testScore}
                testScoredAt={detail.testScoredAt}
                onChange={onChange}
              />

              <LeadDrawerNote
                leadId={detail.id}
                initialNote={detail.adminNote}
                onChange={onChange}
              />

              <section className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-sm font-medium">Communications</h3>
                  {(detail.status === "NEW" || detail.status === "CONTACTED") && (
                    <SendCallbackReminderButton
                      leadId={detail.id}
                      onSent={onChange}
                    />
                  )}
                </div>
                <SmsHistoryList items={detail.smsHistory} />
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-medium px-1">Activity</h3>
                <LeadActivityFeed activities={detail.activities} />
              </section>
            </div>

            {showConvert && (
              <div className="border-t bg-background p-4">
                <LeadConvertButton leadId={detail.id} />
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
