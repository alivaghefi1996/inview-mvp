UPDATE "leads" SET "phone" = '+98' || substr("phone", 2) WHERE "phone" ~ '^09[0-9]{9}$';
UPDATE "otp_challenges" SET "phone" = '+98' || substr("phone", 2) WHERE "phone" ~ '^09[0-9]{9}$';
UPDATE "users" AS "legacy" SET "phone" = '+98' || substr("legacy"."phone", 2)
WHERE "legacy"."phone" ~ '^09[0-9]{9}$'
  AND NOT EXISTS (
    SELECT 1 FROM "users" AS "other" WHERE "other"."phone" = '+98' || substr("legacy"."phone", 2)
  );
