-- Eskiz approved the two verification SMS templates. Apply the returned IDs
-- and flip status to 'service' (approved transactional). The body stays as-is
-- — both templates are single-line with no Eskiz-stripped formatting, so the
-- approved text matches the seed verbatim.
--
-- Idempotent: re-running this is a no-op.

UPDATE "SmsTemplate"
SET "eskizTemplateId" = 77061,
    "status" = 'service',
    "updatedAt" = NOW()
WHERE "code" = 'verification' AND "language" = 'uz';

UPDATE "SmsTemplate"
SET "eskizTemplateId" = 77062,
    "status" = 'service',
    "updatedAt" = NOW()
WHERE "code" = 'verification' AND "language" = 'ru';
