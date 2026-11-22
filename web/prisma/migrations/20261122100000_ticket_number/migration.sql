-- Human-friendly ticket numbers (TKT-0001, TKT-0002, ...). Existing tickets are numbered in the order they were created.
CREATE SEQUENCE "Ticket_number_seq";

ALTER TABLE "Ticket" ADD COLUMN "number" INTEGER;

UPDATE "Ticket" AS t
SET "number" = numbered.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt", id) AS rn
  FROM "Ticket"
) AS numbered
WHERE t.id = numbered.id;

-- Continue after the highest existing number (is_called = false => the next value is exactly this one).
SELECT setval('"Ticket_number_seq"', COALESCE((SELECT MAX("number") FROM "Ticket"), 0) + 1, false);

ALTER TABLE "Ticket" ALTER COLUMN "number" SET DEFAULT nextval('"Ticket_number_seq"');
ALTER TABLE "Ticket" ALTER COLUMN "number" SET NOT NULL;
ALTER SEQUENCE "Ticket_number_seq" OWNED BY "Ticket"."number";

CREATE UNIQUE INDEX "Ticket_number_key" ON "Ticket"("number");
