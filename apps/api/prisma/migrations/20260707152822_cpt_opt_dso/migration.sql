-- CreateTable
CREATE TABLE "CptOptRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentId" TEXT,
    "type" TEXT NOT NULL,
    "fullOrPartTime" TEXT,
    "status" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "employerName" TEXT,
    "employerCity" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CptOptRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DsoContact" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "schoolName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DsoContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CptOptRecord_userId_startDate_idx" ON "CptOptRecord"("userId", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "DsoContact_userId_key" ON "DsoContact"("userId");

-- AddForeignKey
ALTER TABLE "CptOptRecord" ADD CONSTRAINT "CptOptRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CptOptRecord" ADD CONSTRAINT "CptOptRecord_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DsoContact" ADD CONSTRAINT "DsoContact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
