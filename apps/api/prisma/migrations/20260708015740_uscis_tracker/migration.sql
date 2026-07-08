-- CreateTable
CREATE TABLE "UscisCaseTracker" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "caseType" TEXT NOT NULL,
    "lastStatus" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UscisCaseTracker_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UscisCaseTracker_userId_idx" ON "UscisCaseTracker"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UscisCaseTracker_userId_receiptNumber_key" ON "UscisCaseTracker"("userId", "receiptNumber");

-- AddForeignKey
ALTER TABLE "UscisCaseTracker" ADD CONSTRAINT "UscisCaseTracker_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
