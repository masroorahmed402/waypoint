-- AlterTable
ALTER TABLE "StudentProfile" ADD COLUMN     "capGapDetected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "changeOfStatusDetected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "changeOfStatusNotes" TEXT,
ADD COLUMN     "onReducedCourseLoad" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rclEndDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "OptUnemploymentPeriod" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OptUnemploymentPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OptUnemploymentPeriod_userId_idx" ON "OptUnemploymentPeriod"("userId");

-- AddForeignKey
ALTER TABLE "OptUnemploymentPeriod" ADD CONSTRAINT "OptUnemploymentPeriod_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
