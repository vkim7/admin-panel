-- Hardens the PhoneVerification flow against two attacks the original schema
-- couldn't prevent at the data layer:
--
--   1. `salt`: per-row random salt for codeHash. The original implementation
--      reused the row id (a cuid) as salt and stored an empty codeHash on
--      create then patched it in a second update — leaving a brief window
--      where the row was queryable with an empty hash, and a racing user
--      could burn the 5-attempt budget against the empty-hash row.
--
--   2. `redeemedAt`: single-use marker. The verified token (an HMAC) was
--      replayable for 15 min — same token could re-create a Lead after admin
--      deleted the first one. Setting redeemedAt inside the submit
--      transaction atomically makes each verification one-shot.
--
-- Both columns are nullable on existing rows so this migration is safe even
-- with rows already in flight (none expected in prod since the feature is
-- gated behind VERIFY_ALLOWLIST_PHONES). New rows always populate `salt`.

ALTER TABLE "PhoneVerification" ADD COLUMN "salt" TEXT NOT NULL DEFAULT '';
ALTER TABLE "PhoneVerification" ALTER COLUMN "salt" DROP DEFAULT;
ALTER TABLE "PhoneVerification" ADD COLUMN "redeemedAt" TIMESTAMP(3);
