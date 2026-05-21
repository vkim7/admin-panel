-- Add RESUBMITTED to LeadActivityType. Logged when a returning visitor submits
-- the landing form a second time with a phone that already exists as a Lead.
-- Pure additive change — safe to run on a populated table.

ALTER TYPE "LeadActivityType" ADD VALUE 'RESUBMITTED';
