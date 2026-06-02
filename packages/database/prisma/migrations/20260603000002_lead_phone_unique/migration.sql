-- Enforces phone-uniqueness on Lead. Runs after 20260603000001 has merged
-- duplicate phones into single canonical rows; this migration will fail if
-- any duplicates remain (Postgres safety net).
--
-- The app-level dedup in submitLead / submitVerifiedLead handles 99% of
-- collisions before they reach the DB. This constraint catches the narrow
-- race where two parallel calls both pass the findFirst check, by failing
-- the second insert with P2002 — the server actions catch it and return
-- { success: true, duplicate: true }, matching the in-band dedup branch.

ALTER TABLE "Lead" ADD CONSTRAINT "Lead_phone_key" UNIQUE ("phone");
