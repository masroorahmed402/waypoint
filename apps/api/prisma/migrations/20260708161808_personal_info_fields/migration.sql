-- AlterTable
ALTER TABLE "StudentProfile" ADD COLUMN     "admissionNumber" TEXT,
ADD COLUMN     "countryOfBirth" TEXT,
ADD COLUMN     "countryOfCitizenship" TEXT,
ADD COLUMN     "dateOfBirthEncrypted" TEXT,
ADD COLUMN     "i94Number" TEXT,
ADD COLUMN     "passportExpiry" TIMESTAMP(3),
ADD COLUMN     "passportNumberEncrypted" TEXT,
ADD COLUMN     "preferredName" TEXT,
ADD COLUMN     "visaStampExpiry" TIMESTAMP(3),
ADD COLUMN     "visaStampIssueDate" TIMESTAMP(3);
