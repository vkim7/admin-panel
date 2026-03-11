-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('AWAITING_ASSIGNMENT', 'ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "PreferredLanguage" AS ENUM ('UZBEK', 'RUSSIAN');

-- CreateEnum
CREATE TYPE "Level" AS ENUM ('BEGINNER', 'ELEMENTARY', 'PRE_INTERMEDIATE', 'INTERMEDIATE', 'UPPER_INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "ProgressStage" AS ENUM ('BEGINNING', 'MID', 'FINAL');

-- CreateEnum
CREATE TYPE "GroupType" AS ENUM ('GROUP', 'INDIVIDUAL');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'ADMIN');

-- CreateEnum
CREATE TYPE "ExamType" AS ENUM ('MID', 'FINAL');

-- CreateEnum
CREATE TYPE "UncertainFlagSource" AS ENUM ('TEACHER', 'ADMIN');

-- CreateEnum
CREATE TYPE "LessonStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

-- CreateEnum
CREATE TYPE "PromotionType" AS ENUM ('SEASONAL', 'FAMILY', 'LOYALTY', 'WIN_BACK', 'TRIAL', 'EARLY_PAYMENT', 'PARTNER', 'OTHER');

-- CreateEnum
CREATE TYPE "TeacherPayStatus" AS ENUM ('UNPAID', 'PAID');

-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('PENDING', 'COMPLETED');

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "telegramId" BIGINT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "username" TEXT,
    "role" "AdminRole" NOT NULL DEFAULT 'ADMIN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Teacher" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "telegramId" BIGINT,
    "levels" "Level"[],
    "canTeachUzbek" BOOLEAN NOT NULL DEFAULT false,
    "canTeachRussian" BOOLEAN NOT NULL DEFAULT false,
    "canTeachEnglishOnly" BOOLEAN NOT NULL DEFAULT true,
    "groupLessonRate" INTEGER,
    "individualLessonRate" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Teacher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Family" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "parentFirstName" TEXT NOT NULL,
    "parentLastName" TEXT,
    "parentPhone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Family_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "crmCode" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "dateOfBirth" DATE NOT NULL,
    "level" "Level" NOT NULL,
    "status" "StudentStatus" NOT NULL DEFAULT 'AWAITING_ASSIGNMENT',
    "familyId" TEXT,
    "preferredDays" INTEGER[],
    "preferredStartTime" TEXT,
    "preferredLanguage" "PreferredLanguage",
    "referralCode" TEXT,
    "isUncertain" BOOLEAN NOT NULL DEFAULT false,
    "uncertainFlaggedBy" "UncertainFlagSource",
    "uncertainComment" TEXT,
    "comment" TEXT,
    "amoCrmLeadId" TEXT,
    "inactivatedAt" TIMESTAMP(3),
    "lostReasonId" TEXT,
    "otherLostReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherAvailability" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,

    CONSTRAINT "TeacherAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherScheduleSlot" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startTime" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,

    CONSTRAINT "TeacherScheduleSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "type" "GroupType" NOT NULL DEFAULT 'GROUP',
    "teacherId" TEXT NOT NULL,
    "days" INTEGER[],
    "startTime" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 80,
    "level" "Level" NOT NULL,
    "progressStage" "ProgressStage" NOT NULL DEFAULT 'BEGINNING',
    "maxStudents" INTEGER NOT NULL DEFAULT 6,
    "pricePerLesson" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "mergedIntoGroupId" TEXT,
    "zoomLink" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransferReason" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isOther" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransferReason_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LostReason" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isOther" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LostReason_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupMembership" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "joinDate" DATE NOT NULL,
    "leaveDate" DATE,
    "isTrial" BOOLEAN NOT NULL DEFAULT false,
    "transferReasonId" TEXT,
    "otherTransferReason" TEXT,
    "comment" TEXT,
    "lessonsStart" INTEGER,
    "lessonsCompleted" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "lessonNumber" INTEGER NOT NULL,
    "lessonDate" DATE NOT NULL,
    "startTime" TEXT NOT NULL,
    "status" "LessonStatus" NOT NULL DEFAULT 'SCHEDULED',
    "rescheduledFromId" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "activeStudentCount" INTEGER,
    "notes" TEXT,
    "recordingUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "isAbsent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentPaymentPeriod" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "groupMembershipId" TEXT NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "totalLessons" INTEGER NOT NULL,
    "lessonsPaid" INTEGER NOT NULL DEFAULT 0,
    "pricePerLesson" INTEGER NOT NULL,
    "amountDue" INTEGER NOT NULL,
    "discountAmount" INTEGER NOT NULL DEFAULT 0,
    "amountPaid" INTEGER NOT NULL DEFAULT 0,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "isProrated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentPaymentPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "studentPaymentPeriodId" TEXT,
    "amount" INTEGER NOT NULL,
    "paymentMethod" TEXT,
    "note" TEXT,
    "recordedById" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherPaymentPeriod" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "lessonsCompleted" INTEGER NOT NULL,
    "totalStudentLessons" INTEGER NOT NULL,
    "rate" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "TeacherPayStatus" NOT NULL DEFAULT 'UNPAID',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherPaymentPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Promotion" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PromotionType" NOT NULL,
    "discountType" "DiscountType" NOT NULL,
    "discountPercent" INTEGER,
    "discountAmount" INTEGER,
    "levels" "Level"[],
    "groupTypes" "GroupType"[],
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurringMonths" INTEGER,
    "maxUsesPerStudent" INTEGER,
    "maxUsesTotal" INTEGER,
    "validityDays" INTEGER,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "code" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentPromotion" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "monthsUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentPromotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppliedPromotion" (
    "id" TEXT NOT NULL,
    "studentPaymentPeriodId" TEXT NOT NULL,
    "studentPromotionId" TEXT NOT NULL,
    "discountAmount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppliedPromotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "referrerStudentId" TEXT NOT NULL,
    "referredStudentId" TEXT NOT NULL,
    "status" "ReferralStatus" NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallHistory" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "calledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "calledById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsHistory" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exam" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "type" "ExamType" NOT NULL,
    "scheduledDate" DATE NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_telegramId_key" ON "AdminUser"("telegramId");

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_phone_key" ON "Teacher"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_telegramId_key" ON "Teacher"("telegramId");

-- CreateIndex
CREATE INDEX "Family_parentPhone_idx" ON "Family"("parentPhone");

-- CreateIndex
CREATE UNIQUE INDEX "Student_crmCode_key" ON "Student"("crmCode");

-- CreateIndex
CREATE UNIQUE INDEX "Student_phone_key" ON "Student"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Student_referralCode_key" ON "Student"("referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "Student_amoCrmLeadId_key" ON "Student"("amoCrmLeadId");

-- CreateIndex
CREATE INDEX "Student_status_idx" ON "Student"("status");

-- CreateIndex
CREATE INDEX "Student_level_idx" ON "Student"("level");

-- CreateIndex
CREATE INDEX "Student_isUncertain_idx" ON "Student"("isUncertain");

-- CreateIndex
CREATE INDEX "Student_familyId_idx" ON "Student"("familyId");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherAvailability_teacherId_dayOfWeek_startTime_key" ON "TeacherAvailability"("teacherId", "dayOfWeek", "startTime");

-- CreateIndex
CREATE INDEX "TeacherScheduleSlot_groupId_idx" ON "TeacherScheduleSlot"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherScheduleSlot_teacherId_date_startTime_key" ON "TeacherScheduleSlot"("teacherId", "date", "startTime");

-- CreateIndex
CREATE UNIQUE INDEX "Group_publicId_key" ON "Group"("publicId");

-- CreateIndex
CREATE INDEX "Group_teacherId_idx" ON "Group"("teacherId");

-- CreateIndex
CREATE INDEX "Group_isActive_type_idx" ON "Group"("isActive", "type");

-- CreateIndex
CREATE UNIQUE INDEX "TransferReason_name_key" ON "TransferReason"("name");

-- CreateIndex
CREATE UNIQUE INDEX "LostReason_name_key" ON "LostReason"("name");

-- CreateIndex
CREATE INDEX "GroupMembership_studentId_idx" ON "GroupMembership"("studentId");

-- CreateIndex
CREATE INDEX "GroupMembership_groupId_idx" ON "GroupMembership"("groupId");

-- CreateIndex
CREATE INDEX "GroupMembership_groupId_leaveDate_idx" ON "GroupMembership"("groupId", "leaveDate");

-- CreateIndex
CREATE INDEX "GroupMembership_studentId_leaveDate_idx" ON "GroupMembership"("studentId", "leaveDate");

-- CreateIndex
CREATE UNIQUE INDEX "Lesson_rescheduledFromId_key" ON "Lesson"("rescheduledFromId");

-- CreateIndex
CREATE INDEX "Lesson_groupId_idx" ON "Lesson"("groupId");

-- CreateIndex
CREATE INDEX "Lesson_lessonDate_idx" ON "Lesson"("lessonDate");

-- CreateIndex
CREATE INDEX "Lesson_status_idx" ON "Lesson"("status");

-- CreateIndex
CREATE INDEX "Lesson_teacherId_lessonDate_idx" ON "Lesson"("teacherId", "lessonDate");

-- CreateIndex
CREATE INDEX "Lesson_teacherId_status_lessonDate_idx" ON "Lesson"("teacherId", "status", "lessonDate");

-- CreateIndex
CREATE UNIQUE INDEX "Lesson_groupId_lessonNumber_key" ON "Lesson"("groupId", "lessonNumber");

-- CreateIndex
CREATE INDEX "Attendance_studentId_groupId_idx" ON "Attendance"("studentId", "groupId");

-- CreateIndex
CREATE INDEX "Attendance_groupId_idx" ON "Attendance"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_lessonId_studentId_key" ON "Attendance"("lessonId", "studentId");

-- CreateIndex
CREATE INDEX "StudentPaymentPeriod_studentId_idx" ON "StudentPaymentPeriod"("studentId");

-- CreateIndex
CREATE INDEX "StudentPaymentPeriod_groupId_idx" ON "StudentPaymentPeriod"("groupId");

-- CreateIndex
CREATE INDEX "StudentPaymentPeriod_groupMembershipId_idx" ON "StudentPaymentPeriod"("groupMembershipId");

-- CreateIndex
CREATE INDEX "StudentPaymentPeriod_paymentStatus_idx" ON "StudentPaymentPeriod"("paymentStatus");

-- CreateIndex
CREATE INDEX "StudentPaymentPeriod_periodYear_periodMonth_paymentStatus_idx" ON "StudentPaymentPeriod"("periodYear", "periodMonth", "paymentStatus");

-- CreateIndex
CREATE UNIQUE INDEX "StudentPaymentPeriod_studentId_groupMembershipId_periodYear_key" ON "StudentPaymentPeriod"("studentId", "groupMembershipId", "periodYear", "periodMonth");

-- CreateIndex
CREATE INDEX "Payment_studentId_idx" ON "Payment"("studentId");

-- CreateIndex
CREATE INDEX "Payment_studentPaymentPeriodId_idx" ON "Payment"("studentPaymentPeriodId");

-- CreateIndex
CREATE INDEX "TeacherPaymentPeriod_teacherId_idx" ON "TeacherPaymentPeriod"("teacherId");

-- CreateIndex
CREATE INDEX "TeacherPaymentPeriod_periodYear_periodMonth_status_idx" ON "TeacherPaymentPeriod"("periodYear", "periodMonth", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherPaymentPeriod_teacherId_groupId_periodYear_periodMon_key" ON "TeacherPaymentPeriod"("teacherId", "groupId", "periodYear", "periodMonth");

-- CreateIndex
CREATE UNIQUE INDEX "Promotion_code_key" ON "Promotion"("code");

-- CreateIndex
CREATE INDEX "StudentPromotion_studentId_idx" ON "StudentPromotion"("studentId");

-- CreateIndex
CREATE INDEX "StudentPromotion_promotionId_idx" ON "StudentPromotion"("promotionId");

-- CreateIndex
CREATE UNIQUE INDEX "AppliedPromotion_studentPaymentPeriodId_studentPromotionId_key" ON "AppliedPromotion"("studentPaymentPeriodId", "studentPromotionId");

-- CreateIndex
CREATE INDEX "Referral_referrerStudentId_idx" ON "Referral"("referrerStudentId");

-- CreateIndex
CREATE INDEX "Referral_referredStudentId_idx" ON "Referral"("referredStudentId");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_referrerStudentId_referredStudentId_key" ON "Referral"("referrerStudentId", "referredStudentId");

-- CreateIndex
CREATE INDEX "CallHistory_studentId_idx" ON "CallHistory"("studentId");

-- CreateIndex
CREATE INDEX "SmsHistory_studentId_idx" ON "SmsHistory"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Holiday_date_key" ON "Holiday"("date");

-- CreateIndex
CREATE INDEX "Exam_groupId_idx" ON "Exam"("groupId");

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_lostReasonId_fkey" FOREIGN KEY ("lostReasonId") REFERENCES "LostReason"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAvailability" ADD CONSTRAINT "TeacherAvailability_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherScheduleSlot" ADD CONSTRAINT "TeacherScheduleSlot_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherScheduleSlot" ADD CONSTRAINT "TeacherScheduleSlot_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_mergedIntoGroupId_fkey" FOREIGN KEY ("mergedIntoGroupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMembership" ADD CONSTRAINT "GroupMembership_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMembership" ADD CONSTRAINT "GroupMembership_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMembership" ADD CONSTRAINT "GroupMembership_transferReasonId_fkey" FOREIGN KEY ("transferReasonId") REFERENCES "TransferReason"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_rescheduledFromId_fkey" FOREIGN KEY ("rescheduledFromId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPaymentPeriod" ADD CONSTRAINT "StudentPaymentPeriod_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPaymentPeriod" ADD CONSTRAINT "StudentPaymentPeriod_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPaymentPeriod" ADD CONSTRAINT "StudentPaymentPeriod_groupMembershipId_fkey" FOREIGN KEY ("groupMembershipId") REFERENCES "GroupMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_studentPaymentPeriodId_fkey" FOREIGN KEY ("studentPaymentPeriodId") REFERENCES "StudentPaymentPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherPaymentPeriod" ADD CONSTRAINT "TeacherPaymentPeriod_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherPaymentPeriod" ADD CONSTRAINT "TeacherPaymentPeriod_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPromotion" ADD CONSTRAINT "StudentPromotion_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPromotion" ADD CONSTRAINT "StudentPromotion_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppliedPromotion" ADD CONSTRAINT "AppliedPromotion_studentPaymentPeriodId_fkey" FOREIGN KEY ("studentPaymentPeriodId") REFERENCES "StudentPaymentPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppliedPromotion" ADD CONSTRAINT "AppliedPromotion_studentPromotionId_fkey" FOREIGN KEY ("studentPromotionId") REFERENCES "StudentPromotion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrerStudentId_fkey" FOREIGN KEY ("referrerStudentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referredStudentId_fkey" FOREIGN KEY ("referredStudentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallHistory" ADD CONSTRAINT "CallHistory_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallHistory" ADD CONSTRAINT "CallHistory_calledById_fkey" FOREIGN KEY ("calledById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsHistory" ADD CONSTRAINT "SmsHistory_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsHistory" ADD CONSTRAINT "SmsHistory_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── Custom DB-Level Constraints ────────────────────────────────────────────
-- Only race-condition-sensitive constraints and computed-field triggers.
-- All CHECK constraints (validation) are enforced via Zod at the app level.

-- A student can only have one active membership per group at a time
-- (leaveDate IS NULL = currently active)
CREATE UNIQUE INDEX active_membership_unique
  ON "GroupMembership" ("studentId", "groupId")
  WHERE "leaveDate" IS NULL;

-- ─── Auto-computed ID Triggers ─────────────────────────────────────────────

-- Student.crmCode: plain sequence number as string
CREATE OR REPLACE FUNCTION set_student_crm_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."crmCode" = '' OR NEW."crmCode" IS NULL THEN
    NEW."crmCode" = NEW."sequenceNumber"::text;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER student_crm_code_trigger
  BEFORE INSERT ON "Student"
  FOR EACH ROW
  EXECUTE FUNCTION set_student_crm_code();

-- Group.publicId: type prefix + sequenceNumber
CREATE OR REPLACE FUNCTION set_group_public_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."publicId" = '' OR NEW."publicId" IS NULL THEN
    IF NEW."type" = 'GROUP' THEN
      NEW."publicId" = 'GR-' || NEW."sequenceNumber";
    ELSE
      NEW."publicId" = 'IND-' || NEW."sequenceNumber";
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER group_public_id_trigger
  BEFORE INSERT ON "Group"
  FOR EACH ROW
  EXECUTE FUNCTION set_group_public_id();
