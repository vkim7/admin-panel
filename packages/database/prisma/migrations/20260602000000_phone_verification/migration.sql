-- Phone-number verification for the landing /verify flow.
-- Adds:
--   * Lead.phoneVerified — true when the lead came through SMS-OTP verification.
--   * PhoneVerification — one row per code issued. Code stored as bcrypt hash;
--     verifiedAt set on success. Rate limiting uses (phone, createdAt) index.

ALTER TABLE "Lead" ADD COLUMN "phoneVerified" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "PhoneVerification" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhoneVerification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PhoneVerification_phone_createdAt_idx" ON "PhoneVerification"("phone", "createdAt");

-- Seed verification SMS templates. `eskizTemplateId` is null until Eskiz
-- approves the templates; the send funnel handles a null eskizTemplateId by
-- logging a SKIPPED SmsHistory row instead of dispatching, so the verify flow
-- can be tested on the allowlist before approval lands.
INSERT INTO "SmsTemplate" ("id", "code", "language", "body", "status", "isActive", "createdAt", "updatedAt")
VALUES
  (
    'seed_verify_ru',
    'verification',
    'ru',
    'Banana School: код подтверждения для отправки заявки: {code}',
    'moderation',
    true,
    NOW(),
    NOW()
  ),
  (
    'seed_verify_uz',
    'verification',
    'uz',
    'Banana School maktabiga arizani yuborish uchun tasdiqlash kodi: {code}',
    'moderation',
    true,
    NOW(),
    NOW()
  );
