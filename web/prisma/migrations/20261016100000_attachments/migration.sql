-- Attachments: real upload support.
--
-- The old Attachment table was a placeholder that nothing ever wrote to. `uploadedById` is NOT NULL
-- and cannot be back-filled, so refuse loudly if any rows exist rather than failing obscurely.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Attachment") THEN
    RAISE EXCEPTION 'Attachment table is not empty; back-fill uploadedById before applying this migration';
  END IF;
END $$;

-- fileUrl was a URL placeholder; files are now served through an authorized route, so the column
-- becomes an opaque storage key (renamed, not dropped).
ALTER TABLE "Attachment" RENAME COLUMN "fileUrl" TO "storageKey";

-- AlterTable
ALTER TABLE "Attachment"
ADD COLUMN     "commentId" TEXT,
ADD COLUMN     "isInternal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "uploadedById" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Attachment_storageKey_key" ON "Attachment"("storageKey");

-- CreateIndex
CREATE INDEX "Attachment_commentId_idx" ON "Attachment"("commentId");

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
