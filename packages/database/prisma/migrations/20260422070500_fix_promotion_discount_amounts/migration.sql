-- Fix fixed-amount promotion discounts: 100,000 → 70,000 UZS
UPDATE "Promotion"
SET "discountAmount" = 70000
WHERE "discountType" = 'FIXED_AMOUNT'
  AND "discountAmount" = 100000;
