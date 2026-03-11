-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('AWAITING_ASSIGNMENT', 'ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "PreferredLanguage" AS ENUM ('UZBEK', 'RUSSIAN');

-- CreateEnum
CREATE TYPE "Level" AS ENUM ('BEGINNER', 'ELEMENTARY', 'PRE_INTERMEDIATE', 'INTERMEDIATE', 'UPPER_INTERMEDIATE', 'IELTS');

-- CreateEnum
CREATE TYPE "LevelCategory" AS ENUM ('GENERAL', 'IELTS');

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
CREATE TYPE "LessonStatus" AS ENUM ('SCHEDULED', 'PENDING_RESOLUTION', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

-- CreateEnum
CREATE TYPE "PromotionType" AS ENUM ('SEASONAL', 'FAMILY', 'LOYALTY', 'WIN_BACK', 'TRIAL', 'EARLY_PAYMENT', 'PARTNER', 'OTHER');

-- CreateEnum
CREATE TYPE "TeacherPayStatus" AS ENUM ('UNPAID', 'PAID');

-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('PENDING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "AdjustmentType" AS ENUM ('MANUAL', 'TRANSFER', 'DROPOUT', 'MERGE');

-- CreateEnum
CREATE TYPE "SmsStatus" AS ENUM ('SENT', 'DELIVERED', 'FAILED');

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "telegramId" BIGINT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
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
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deactivatedAt" TIMESTAMP(3),
    "deactivatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Teacher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Family" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "parentFirstName" TEXT NOT NULL,
    "parentLastName" TEXT NOT NULL,
    "parentPhone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Family_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "crmCode" TEXT NOT NULL DEFAULT '',
    "sequenceNumber" SERIAL NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "telegramId" BIGINT,
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
    "activatedAt" TIMESTAMP(3),
    "activatedById" TEXT,
    "inactivatedAt" TIMESTAMP(3),
    "inactivatedById" TEXT,
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
CREATE TABLE "TeacherUnavailability" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "reason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherUnavailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherScheduleSlot" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startTime" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,

    CONSTRAINT "TeacherScheduleSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL DEFAULT '',
    "sequenceNumber" SERIAL NOT NULL,
    "type" "GroupType" NOT NULL DEFAULT 'GROUP',
    "teacherId" TEXT NOT NULL,
    "days" INTEGER[],
    "startTime" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 80,
    "level" "Level" NOT NULL,
    "progressStage" "ProgressStage" NOT NULL DEFAULT 'BEGINNING',
    "maxStudents" INTEGER NOT NULL DEFAULT 6,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "mergedIntoGroupId" TEXT,
    "skipAutoGraduation" BOOLEAN NOT NULL DEFAULT false,
    "graduatedIntoGroupId" TEXT,
    "zoomLink" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupTeacherHistory" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "changedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupTeacherHistory_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "CancellationReason" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isOther" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CancellationReason_pkey" PRIMARY KEY ("id")
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
    "assignedById" TEXT,
    "previousMembershipId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "originalTeacherId" TEXT NOT NULL,
    "lessonNumber" INTEGER NOT NULL,
    "lessonDate" DATE NOT NULL,
    "startTime" TEXT NOT NULL,
    "status" "LessonStatus" NOT NULL DEFAULT 'SCHEDULED',
    "originalDate" DATE,
    "originalStartTime" TEXT,
    "pendingAt" TIMESTAMP(3),
    "rescheduledFromId" TEXT,
    "originalLessonId" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "cancellationReasonId" TEXT,
    "otherCancellationReason" TEXT,
    "completedAt" TIMESTAMP(3),
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
    "pricePerLesson" INTEGER NOT NULL,
    "amountDue" INTEGER NOT NULL,
    "discountAmount" INTEGER NOT NULL DEFAULT 0,
    "amountPaid" INTEGER NOT NULL DEFAULT 0,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "isPartialPeriod" BOOLEAN NOT NULL DEFAULT false,
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
    "isTransferCredit" BOOLEAN NOT NULL DEFAULT false,
    "paymentMethod" TEXT,
    "note" TEXT,
    "recordedById" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentPeriodAdjustment" (
    "id" TEXT NOT NULL,
    "studentPaymentPeriodId" TEXT NOT NULL,
    "type" "AdjustmentType" NOT NULL,
    "previousTotalLessons" INTEGER NOT NULL,
    "previousAmountDue" INTEGER NOT NULL,
    "previousDiscountAmount" INTEGER NOT NULL,
    "newTotalLessons" INTEGER NOT NULL,
    "newAmountDue" INTEGER NOT NULL,
    "newDiscountAmount" INTEGER NOT NULL,
    "reason" TEXT,
    "adjustedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentPeriodAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "studentPaymentPeriodId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "amountRefunded" INTEGER,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "paymentMethod" TEXT,
    "note" TEXT,
    "initiatedById" TEXT NOT NULL,
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedById" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
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
    "generatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherPaymentPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherRateChange" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "groupLessonRate" INTEGER NOT NULL,
    "individualLessonRate" INTEGER NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "changedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherRateChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceSetting" (
    "id" TEXT NOT NULL,
    "levelCategory" "LevelCategory" NOT NULL,
    "groupType" "GroupType" NOT NULL,
    "pricePerLesson" INTEGER NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "changedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceSetting_pkey" PRIMARY KEY ("id")
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
    "status" "SmsStatus" NOT NULL DEFAULT 'SENT',
    "deliveredAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "providerMessageId" TEXT,
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
CREATE UNIQUE INDEX "Student_sequenceNumber_key" ON "Student"("sequenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Student_phone_key" ON "Student"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Student_telegramId_key" ON "Student"("telegramId");

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
CREATE INDEX "TeacherUnavailability_teacherId_date_idx" ON "TeacherUnavailability"("teacherId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherScheduleSlot_lessonId_key" ON "TeacherScheduleSlot"("lessonId");

-- CreateIndex
CREATE INDEX "TeacherScheduleSlot_groupId_idx" ON "TeacherScheduleSlot"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherScheduleSlot_teacherId_date_startTime_key" ON "TeacherScheduleSlot"("teacherId", "date", "startTime");

-- CreateIndex
CREATE UNIQUE INDEX "Group_publicId_key" ON "Group"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "Group_sequenceNumber_key" ON "Group"("sequenceNumber");

-- CreateIndex
CREATE INDEX "Group_teacherId_idx" ON "Group"("teacherId");

-- CreateIndex
CREATE INDEX "Group_isActive_type_idx" ON "Group"("isActive", "type");

-- CreateIndex
CREATE INDEX "Group_level_idx" ON "Group"("level");

-- CreateIndex
CREATE INDEX "GroupTeacherHistory_groupId_idx" ON "GroupTeacherHistory"("groupId");

-- CreateIndex
CREATE INDEX "GroupTeacherHistory_teacherId_idx" ON "GroupTeacherHistory"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "TransferReason_name_key" ON "TransferReason"("name");

-- CreateIndex
CREATE UNIQUE INDEX "LostReason_name_key" ON "LostReason"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CancellationReason_name_key" ON "CancellationReason"("name");

-- CreateIndex
CREATE INDEX "GroupMembership_studentId_idx" ON "GroupMembership"("studentId");

-- CreateIndex
CREATE INDEX "GroupMembership_groupId_idx" ON "GroupMembership"("groupId");

-- CreateIndex
CREATE INDEX "GroupMembership_groupId_leaveDate_idx" ON "GroupMembership"("groupId", "leaveDate");

-- CreateIndex
CREATE INDEX "GroupMembership_studentId_leaveDate_idx" ON "GroupMembership"("studentId", "leaveDate");

-- CreateIndex
CREATE INDEX "GroupMembership_isTrial_idx" ON "GroupMembership"("isTrial");

-- CreateIndex
CREATE UNIQUE INDEX "Lesson_rescheduledFromId_key" ON "Lesson"("rescheduledFromId");

-- CreateIndex
CREATE INDEX "Lesson_groupId_lessonDate_idx" ON "Lesson"("groupId", "lessonDate");

-- CreateIndex
CREATE INDEX "Lesson_lessonDate_idx" ON "Lesson"("lessonDate");

-- CreateIndex
CREATE INDEX "Lesson_status_idx" ON "Lesson"("status");

-- CreateIndex
CREATE INDEX "Lesson_teacherId_lessonDate_idx" ON "Lesson"("teacherId", "lessonDate");

-- CreateIndex
CREATE INDEX "Lesson_teacherId_status_lessonDate_idx" ON "Lesson"("teacherId", "status", "lessonDate");

-- CreateIndex
CREATE INDEX "Lesson_originalLessonId_idx" ON "Lesson"("originalLessonId");

-- CreateIndex
CREATE INDEX "Lesson_groupId_status_idx" ON "Lesson"("groupId", "status");

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
CREATE UNIQUE INDEX "StudentPaymentPeriod_groupMembershipId_periodYear_periodMon_key" ON "StudentPaymentPeriod"("groupMembershipId", "periodYear", "periodMonth");

-- CreateIndex
CREATE INDEX "Payment_studentId_idx" ON "Payment"("studentId");

-- CreateIndex
CREATE INDEX "Payment_studentPaymentPeriodId_idx" ON "Payment"("studentPaymentPeriodId");

-- CreateIndex
CREATE INDEX "PaymentPeriodAdjustment_studentPaymentPeriodId_idx" ON "PaymentPeriodAdjustment"("studentPaymentPeriodId");

-- CreateIndex
CREATE INDEX "Refund_studentId_idx" ON "Refund"("studentId");

-- CreateIndex
CREATE INDEX "Refund_studentPaymentPeriodId_idx" ON "Refund"("studentPaymentPeriodId");

-- CreateIndex
CREATE INDEX "Refund_status_idx" ON "Refund"("status");

-- CreateIndex
CREATE INDEX "TeacherPaymentPeriod_teacherId_idx" ON "TeacherPaymentPeriod"("teacherId");

-- CreateIndex
CREATE INDEX "TeacherPaymentPeriod_periodYear_periodMonth_status_idx" ON "TeacherPaymentPeriod"("periodYear", "periodMonth", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherPaymentPeriod_teacherId_groupId_periodYear_periodMon_key" ON "TeacherPaymentPeriod"("teacherId", "groupId", "periodYear", "periodMonth");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherRateChange_teacherId_effectiveFrom_key" ON "TeacherRateChange"("teacherId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "PriceSetting_levelCategory_groupType_effectiveFrom_key" ON "PriceSetting"("levelCategory", "groupType", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "Promotion_code_key" ON "Promotion"("code");

-- CreateIndex
CREATE INDEX "StudentPromotion_studentId_idx" ON "StudentPromotion"("studentId");

-- CreateIndex
CREATE INDEX "StudentPromotion_promotionId_idx" ON "StudentPromotion"("promotionId");

-- CreateIndex
CREATE UNIQUE INDEX "AppliedPromotion_studentPaymentPeriodId_studentPromotionId_key" ON "AppliedPromotion"("studentPaymentPeriodId", "studentPromotionId");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_referredStudentId_key" ON "Referral"("referredStudentId");

-- CreateIndex
CREATE INDEX "Referral_referrerStudentId_idx" ON "Referral"("referrerStudentId");

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
ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_deactivatedById_fkey" FOREIGN KEY ("deactivatedById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_activatedById_fkey" FOREIGN KEY ("activatedById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_inactivatedById_fkey" FOREIGN KEY ("inactivatedById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_lostReasonId_fkey" FOREIGN KEY ("lostReasonId") REFERENCES "LostReason"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAvailability" ADD CONSTRAINT "TeacherAvailability_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherUnavailability" ADD CONSTRAINT "TeacherUnavailability_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherUnavailability" ADD CONSTRAINT "TeacherUnavailability_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherScheduleSlot" ADD CONSTRAINT "TeacherScheduleSlot_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherScheduleSlot" ADD CONSTRAINT "TeacherScheduleSlot_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherScheduleSlot" ADD CONSTRAINT "TeacherScheduleSlot_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_mergedIntoGroupId_fkey" FOREIGN KEY ("mergedIntoGroupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_graduatedIntoGroupId_fkey" FOREIGN KEY ("graduatedIntoGroupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupTeacherHistory" ADD CONSTRAINT "GroupTeacherHistory_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupTeacherHistory" ADD CONSTRAINT "GroupTeacherHistory_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupTeacherHistory" ADD CONSTRAINT "GroupTeacherHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMembership" ADD CONSTRAINT "GroupMembership_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMembership" ADD CONSTRAINT "GroupMembership_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMembership" ADD CONSTRAINT "GroupMembership_transferReasonId_fkey" FOREIGN KEY ("transferReasonId") REFERENCES "TransferReason"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMembership" ADD CONSTRAINT "GroupMembership_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMembership" ADD CONSTRAINT "GroupMembership_previousMembershipId_fkey" FOREIGN KEY ("previousMembershipId") REFERENCES "GroupMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_originalTeacherId_fkey" FOREIGN KEY ("originalTeacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_rescheduledFromId_fkey" FOREIGN KEY ("rescheduledFromId") REFERENCES "Lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_originalLessonId_fkey" FOREIGN KEY ("originalLessonId") REFERENCES "Lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_cancellationReasonId_fkey" FOREIGN KEY ("cancellationReasonId") REFERENCES "CancellationReason"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
ALTER TABLE "PaymentPeriodAdjustment" ADD CONSTRAINT "PaymentPeriodAdjustment_studentPaymentPeriodId_fkey" FOREIGN KEY ("studentPaymentPeriodId") REFERENCES "StudentPaymentPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentPeriodAdjustment" ADD CONSTRAINT "PaymentPeriodAdjustment_adjustedById_fkey" FOREIGN KEY ("adjustedById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_studentPaymentPeriodId_fkey" FOREIGN KEY ("studentPaymentPeriodId") REFERENCES "StudentPaymentPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherPaymentPeriod" ADD CONSTRAINT "TeacherPaymentPeriod_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherPaymentPeriod" ADD CONSTRAINT "TeacherPaymentPeriod_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherPaymentPeriod" ADD CONSTRAINT "TeacherPaymentPeriod_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherRateChange" ADD CONSTRAINT "TeacherRateChange_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherRateChange" ADD CONSTRAINT "TeacherRateChange_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceSetting" ADD CONSTRAINT "PriceSetting_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
