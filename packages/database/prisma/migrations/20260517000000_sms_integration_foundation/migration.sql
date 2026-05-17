-- SMS integration foundation: polymorphic SmsHistory (student-or-lead recipient),
-- new SmsTemplate and EskizToken models, and the SKIPPED status for the
-- SMS_ALLOWED_PHONES guardrail.

-- 1. SmsStatus enum: add SKIPPED via rename-recreate (matches the precedent in
--    20260419180000_simplify_lead_enums; keeps the change in a single transaction
--    since Postgres can't ADD VALUE to an enum that's mid-transaction).
ALTER TYPE "SmsStatus" RENAME TO "SmsStatus_old";
CREATE TYPE "SmsStatus" AS ENUM ('SENT', 'DELIVERED', 'FAILED', 'SKIPPED');
ALTER TABLE "SmsHistory"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "SmsStatus" USING ("status"::text::"SmsStatus"),
  ALTER COLUMN "status" SET DEFAULT 'SENT';
DROP TYPE "SmsStatus_old";

-- 2. SmsHistory: polymorphic recipient + Eskiz correlation IDs + language tag.
--    Make studentId nullable, add leadId, and rename providerMessageId →
--    eskizRequestId (preserving any existing values). language is added with a
--    default of 'ru' so any pre-existing rows get a sensible value; the default
--    is dropped immediately after so application code is forced to set it.
ALTER TABLE "SmsHistory" ALTER COLUMN "studentId" DROP NOT NULL;

ALTER TABLE "SmsHistory" ADD COLUMN "leadId" TEXT;
ALTER TABLE "SmsHistory" ADD COLUMN "templateId" TEXT;
ALTER TABLE "SmsHistory" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'ru';
ALTER TABLE "SmsHistory" ALTER COLUMN "language" DROP DEFAULT;
ALTER TABLE "SmsHistory" RENAME COLUMN "providerMessageId" TO "eskizRequestId";
ALTER TABLE "SmsHistory" ADD COLUMN "eskizMessageId" INTEGER;

-- CHECK constraint: exactly one of (studentId, leadId) must be set per row.
-- Prisma can't express this at the schema level, so we add it manually here.
ALTER TABLE "SmsHistory"
  ADD CONSTRAINT "SmsHistory_recipient_check"
  CHECK (("studentId" IS NULL) <> ("leadId" IS NULL));

-- Index on the new leadId column (mirrors the existing studentId index) and
-- on eskizRequestId since the webhook handler looks up rows by it.
CREATE INDEX "SmsHistory_leadId_idx" ON "SmsHistory"("leadId");
CREATE INDEX "SmsHistory_eskizRequestId_idx" ON "SmsHistory"("eskizRequestId");

-- 3. SmsTemplate: registered with (and moderated by) Eskiz. `eskizTemplateId`
--    is filled in once approval comes back; until then sends short-circuit to
--    status=FAILED so the operator sees the gap immediately.
CREATE TABLE "SmsTemplate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "eskizTemplateId" INTEGER,
    "status" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SmsTemplate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SmsTemplate_code_language_key" ON "SmsTemplate"("code", "language");

-- 4. EskizToken: singleton row caching the 30-day JWT so Vercel cold starts
--    don't re-login. `id` defaults to "default" — convention-enforced singleton.
CREATE TABLE "EskizToken" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "refreshedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EskizToken_pkey" PRIMARY KEY ("id")
);

-- 5. Foreign keys on the new columns.
-- leadId uses RESTRICT (not SET NULL) so the CHECK constraint remains
-- satisfiable. A SET NULL on a lead-only row would null both recipient columns
-- and violate the XOR. Restrict turns a confusing CHECK error into a clear FK
-- error when someone attempts to delete a Lead that has SMS history.
ALTER TABLE "SmsHistory"
  ADD CONSTRAINT "SmsHistory_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SmsHistory"
  ADD CONSTRAINT "SmsHistory_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "SmsTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 6. Seed the four templates with placeholder eskizTemplateId. Once Eskiz
--    finishes moderating, update each row to set eskizTemplateId and flip
--    status to 'service'. The escaped string literals preserve newlines as
--    real LF characters so the rendered SMS shows paragraph breaks on the
--    recipient's phone.
INSERT INTO "SmsTemplate" ("id", "code", "language", "body", "status", "isActive", "createdAt", "updatedAt")
VALUES
  (
    'seed_greet_ru',
    'lead_greeting',
    'ru',
    E'Здравствуйте, {name}!\nСпасибо за заявку в Banana School. Скоро свяжемся по поводу пробного урока.\n\nСохраните +998979798808, чтобы не пропустить звонок.\n\nИли напишите нам в Telegram: t.me/bananaschool_uz',
    'moderation',
    true,
    NOW(),
    NOW()
  ),
  (
    'seed_greet_uz',
    'lead_greeting',
    'uz',
    E'Assalomu alaykum, {name}!\nBanana School maktabiga arizangiz uchun rahmat. Tez orada sinov darsi haqida bog''lanamiz.\n\nIltimos, +998979798808 raqamini saqlab qo''ying, qo''ng''iroqimizni o''tkazib yubormang.\n\nYoki bizga Telegram orqali yozing: t.me/bananaschool_uz',
    'moderation',
    true,
    NOW(),
    NOW()
  ),
  (
    'seed_rmd_ru',
    'lead_callback_reminder',
    'ru',
    E'Здравствуйте, {name}!\nК сожалению, не дозвонились до вас. Хотели обсудить вашу заявку в Banana School.\n\nПерезвоните: +998979798808\nИли напишите нам в Telegram: t.me/bananaschool_uz\n\nБудем рады общению.',
    'moderation',
    true,
    NOW(),
    NOW()
  ),
  (
    'seed_rmd_uz',
    'lead_callback_reminder',
    'uz',
    E'Assalomu alaykum, {name}!\nAfsuski, siz bilan bog''lanolmadik. Banana School maktabiga arizangiz haqida gaplashmoqchi edik.\n\n+998979798808 raqamiga qayta qo''ng''iroq qiling yoki bizga Telegram orqali yozing: t.me/bananaschool_uz\n\nSizdan xabar kutamiz.',
    'moderation',
    true,
    NOW(),
    NOW()
  );
