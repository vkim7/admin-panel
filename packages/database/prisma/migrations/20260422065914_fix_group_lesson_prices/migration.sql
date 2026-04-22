-- Fix GROUP lesson prices: 100,000 → 47,500 UZS
-- The seed data was updated in commit f3d0576 but existing databases
-- still have the old price. This migration corrects the data.
UPDATE "PriceSetting"
SET "pricePerLesson" = 47500
WHERE "groupType" = 'GROUP'
  AND "pricePerLesson" = 100000;
