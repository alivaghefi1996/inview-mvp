UPDATE "shows" SET "status" = 'published' WHERE "id" IN (
  SELECT DISTINCT ON ("draft"."gallery_id") "draft"."id"
  FROM "shows" AS "draft"
  JOIN "galleries" ON "galleries"."id" = "draft"."gallery_id"
  WHERE "galleries"."status" = 'live'
    AND "draft"."status" = 'draft'
    AND NOT EXISTS (
      SELECT 1 FROM "shows" AS "other"
      WHERE "other"."gallery_id" = "draft"."gallery_id" AND "other"."status" = 'published'
    )
  ORDER BY "draft"."gallery_id", "draft"."updated_at" DESC
);
