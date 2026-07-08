import { Injectable, Inject, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { STORAGE_SERVICE, StorageService } from '../storage/storage.interface';
import { ImmigrationService } from '../immigration/immigration.service';
import { CreateDocumentDto, UpdateDocumentDto, USER_QUOTA_BYTES } from './dto/document.dto';
import { DocumentStatus, DocumentType, DeadlineSource, DeadlineType, ApplicationStage } from '@prisma/client';
import { EXTRACTOR, DocumentExtractor, I20Extract } from './extraction/i20-extract.type';
import { AppConfig } from '../../config/app.config';
import { encryptField } from '../../common/util/field-crypto';
import { AiDocumentExtractor } from './extraction/ai-document.extractor';
import { readPdfText } from './extraction/pdf-text.util';

@Injectable()
export class DocumentsService {
  constructor(
    private prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private storage: StorageService,
    @Inject(EXTRACTOR) private extractor: DocumentExtractor,
    private immigration: ImmigrationService,
    private config: AppConfig,
    private aiExtractor: AiDocumentExtractor,
  ) {}

  /**
   * Read a confirmed I-20 back from storage and extract its fields.
   * Core identity/program fields are returned for the caller (web onboarding) to
   * show the user for confirmation before saving — they are never written here.
   * CPT/OPT authorizations, the DSO contact, and the SEVIS ID are supplementary
   * (previously uncaptured) data with no existing field for the user to
   * knowingly overwrite, so those are persisted automatically when found.
   */
  async extractI20(userId: string, id: string): Promise<I20Extract> {
    const doc = await this.findOwned(userId, id);
    if (doc.type !== DocumentType.I20) {
      throw new BadRequestException('This endpoint only extracts I-20 documents');
    }
    if (doc.contentType !== 'application/pdf') {
      return {
        hasTextLayer: false,
        sevisId: null, surname: null, givenName: null, fullName: null,
        preferredName: null, countryOfBirth: null, countryOfCitizenship: null,
        dateOfBirth: null, admissionNumber: null, passportName: null, schoolName: null,
        schoolOfficialName: null, schoolOfficialTitle: null,
        programOfStudy: null, cipCode: null, isStemDegree: false, degreeLevel: null, programStartDate: null,
        programEndDate: null, startOfClasses: null, issueDate: null,
        currentSessionStart: null, currentSessionEnd: null,
        authorizations: [], foundFields: [],
        notice: 'Auto-fill currently supports PDF I-20s only. Please enter your details manually.',
      };
    }
    const bytes = await this.storage.read(doc.storageKey);
    const result = await this.extractor.extractI20(bytes);
    await this.persistExtractedExtras(userId, doc.id, result);
    return result;
  }

  /** Stores CPT/OPT records, DSO contact, and encrypted SEVIS ID from an I-20 extraction. Best-effort — never throws. */
  private async persistExtractedExtras(userId: string, documentId: string, result: I20Extract): Promise<void> {
    try {
      if (result.authorizations.length) {
        // Re-extraction of the same document should replace, not accumulate.
        // The old records' auto-generated deadlines are keyed to their own
        // (about to be discarded) ids, so they must be cleaned up explicitly —
        // deleting the records alone would orphan those deadlines instead of
        // replacing them, and each re-extraction would leave another behind.
        const stale = await this.prisma.cptOptRecord.findMany({ where: { documentId }, select: { id: true } });
        if (stale.length) {
          await this.prisma.deadline.deleteMany({
            where: { userId, dedupeKey: { in: stale.map((s) => `cptopt:${s.id}`) } },
          });
        }
        await this.prisma.cptOptRecord.deleteMany({ where: { documentId } });
        for (const a of result.authorizations) {
          if (!a.startDate || !a.endDate) continue;
          const record = await this.prisma.cptOptRecord.create({
            data: {
              userId,
              documentId,
              type: a.type,
              fullOrPartTime: a.fullOrPartTime,
              status: a.status,
              startDate: new Date(a.startDate),
              endDate: new Date(a.endDate),
              employerName: a.employerName,
              employerCity: a.employerCity,
            },
          });
          if (record.endDate.getTime() >= Date.now()) {
            await this.immigration.createCptOptDeadline(userId, record);
          }
        }
      }

      if (result.schoolOfficialName) {
        await this.prisma.dsoContact.upsert({
          where: { userId },
          create: {
            userId,
            name: result.schoolOfficialName,
            title: result.schoolOfficialTitle,
            schoolName: result.schoolName,
          },
          update: {
            name: result.schoolOfficialName,
            title: result.schoolOfficialTitle,
            schoolName: result.schoolName,
          },
        });
      }

      if (result.sevisId) {
        await this.prisma.studentProfile.updateMany({
          where: { userId },
          data: { sevisIdEncrypted: encryptField(result.sevisId, this.config.fieldEncryptionKey) },
        });
      }

      // The I-20 is the authoritative source for the student's legal name — registration
      // no longer asks for it, so fill it in here the first time we have both parts.
      if (result.givenName && result.surname) {
        await this.prisma.user.update({
          where: { id: userId },
          data: { firstName: result.givenName, lastName: result.surname },
        });
      }

      const personalInfoUpdates: Record<string, unknown> = {};
      if (result.dateOfBirth) {
        personalInfoUpdates.dateOfBirthEncrypted = encryptField(result.dateOfBirth, this.config.fieldEncryptionKey);
      }
      if (result.admissionNumber) personalInfoUpdates.admissionNumber = result.admissionNumber;
      if (result.countryOfBirth) personalInfoUpdates.countryOfBirth = result.countryOfBirth;
      if (result.countryOfCitizenship) personalInfoUpdates.countryOfCitizenship = result.countryOfCitizenship;
      if (result.preferredName) personalInfoUpdates.preferredName = result.preferredName;
      if (Object.keys(personalInfoUpdates).length) {
        await this.prisma.studentProfile.updateMany({ where: { userId }, data: personalInfoUpdates });
      }

      if (result.isStemDegree) {
        // Only recompute deadlines if this actually flips the flag — avoids a
        // needless recompute call on every re-extraction of an already-STEM profile.
        const flipped = await this.prisma.studentProfile.updateMany({
          where: { userId, stemEligible: false },
          data: { stemEligible: true, cipCode: result.cipCode },
        });
        if (flipped.count > 0) await this.immigration.recomputeSystemDeadlines(userId);
      } else if (result.cipCode) {
        await this.prisma.studentProfile.updateMany({ where: { userId }, data: { cipCode: result.cipCode } });
      }
    } catch {
      // Extraction extras are a bonus, not the primary flow — never fail the confirm/extract step over them.
    }
  }

  list(userId: string) {
    return this.prisma.document.findMany({
      where: { userId, status: { not: DocumentStatus.DELETED } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, type: true, status: true, fileName: true, contentType: true,
        sizeBytes: true, issueDate: true, expiryDate: true, createdAt: true,
      },
    });
  }

  /** Step 1: validate + create PENDING row + return presigned PUT. */
  async initiate(userId: string, dto: CreateDocumentDto) {
    const used = await this.prisma.document.aggregate({
      where: { userId, status: { not: DocumentStatus.DELETED } },
      _sum: { sizeBytes: true },
    });
    if ((used._sum.sizeBytes ?? 0) + dto.sizeBytes > USER_QUOTA_BYTES) {
      throw new ForbiddenException('Storage quota exceeded (500 MB). Delete old documents first.');
    }

    const ext = safeExtension(dto.fileName, dto.contentType);
    const storageKey = `users/${userId}/documents/${randomUUID()}${ext}`;

    const document = await this.prisma.document.create({
      data: {
        userId,
        type: dto.type,
        fileName: sanitizeFileName(dto.fileName),
        contentType: dto.contentType,
        sizeBytes: dto.sizeBytes,
        storageKey,
        issueDate: dto.issueDate ? new Date(dto.issueDate) : null,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
      },
    });

    const upload = await this.storage.presignUpload(storageKey, dto.contentType, dto.sizeBytes);
    return { document, upload };
  }

  /** Step 2: verify the object actually landed, then activate + wire deadlines. */
  async confirm(userId: string, id: string) {
    const doc = await this.findOwned(userId, id);
    if (doc.status === DocumentStatus.ACTIVE) return doc;

    const head = await this.storage.head(doc.storageKey);
    if (!head.exists) throw new BadRequestException('Upload not found, retry the upload');
    if (head.sizeBytes !== undefined && head.sizeBytes > doc.sizeBytes * 1.05) {
      await this.storage.delete(doc.storageKey);
      throw new BadRequestException('Uploaded file does not match declared size');
    }

    const updated = await this.prisma.document.update({
      where: { id },
      data: { status: DocumentStatus.ACTIVE },
    });

    if (updated.expiryDate) {
      await this.immigration.upsertDocumentExpiryDeadline(
        userId, updated.id, updated.type, updated.fileName, updated.expiryDate,
      );
    }

    if (updated.type === DocumentType.I20) {
      await this.extractI20(userId, updated.id);
    } else {
      await this.extractAndStoreDocumentData(userId, updated.id, updated.type, updated.storageKey);
    }

    return updated;
  }

  /** Best-effort AI extraction for document types the free parser doesn't cover. Never throws. */
  private async extractAndStoreDocumentData(userId: string, documentId: string, docType: DocumentType, storageKey: string): Promise<void> {
    try {
      const bytes = await this.storage.read(storageKey);
      const text = await readPdfText(bytes);

      switch (docType) {
        case DocumentType.PASSPORT:
          await this.extractPassportData(userId, documentId, text);
          break;
        case DocumentType.VISA_STAMP:
          await this.extractVisaData(userId, documentId, text);
          break;
        case DocumentType.OFFER_LETTER:
          await this.extractOfferLetterData(userId, text);
          break;
        case DocumentType.LEASE:
          await this.extractLeaseData(userId, documentId, text);
          break;
        case DocumentType.INSURANCE:
          await this.extractInsuranceData(userId, documentId, text);
          break;
        case DocumentType.TAX:
          await this.extractTaxData(userId, text);
          break;
        default:
          break;
      }
    } catch {
      // Extraction extras are a bonus, not the primary upload flow.
    }
  }

  private async extractPassportData(userId: string, documentId: string, text: string): Promise<void> {
    const data = await this.aiExtractor.extractPassport(text);
    const updates: Record<string, unknown> = {};
    if (data.passportNumber) updates.passportNumberEncrypted = encryptField(data.passportNumber, this.config.fieldEncryptionKey);
    if (data.dateOfBirth) updates.dateOfBirthEncrypted = encryptField(data.dateOfBirth, this.config.fieldEncryptionKey);
    if (data.expiryDate) updates.passportExpiry = new Date(data.expiryDate);
    if (data.nationality) updates.countryOfCitizenship = data.nationality;
    if (Object.keys(updates).length) {
      await this.prisma.studentProfile.updateMany({ where: { userId }, data: updates });
    }
    if (data.expiryDate) {
      await this.immigration.upsertDocumentExpiryDeadline(userId, documentId, DocumentType.PASSPORT, 'Passport', new Date(data.expiryDate));
    }
  }

  private async extractVisaData(userId: string, documentId: string, text: string): Promise<void> {
    const data = await this.aiExtractor.extractVisa(text);
    if (!data.expiryDate) return;
    await this.prisma.studentProfile.updateMany({
      where: { userId },
      data: { visaStampExpiry: new Date(data.expiryDate), ...(data.issueDate && { visaStampIssueDate: new Date(data.issueDate) }) },
    });
    await this.immigration.upsertDocumentExpiryDeadline(userId, documentId, DocumentType.VISA_STAMP, 'Visa stamp', new Date(data.expiryDate));
  }

  private async extractOfferLetterData(userId: string, text: string): Promise<void> {
    const data = await this.aiExtractor.extractOfferLetter(text);
    if (!data.companyName || !data.jobTitle) return;

    const existing = await this.prisma.application.findFirst({
      where: { userId, companyName: { contains: data.companyName, mode: 'insensitive' } },
    });
    if (existing) return;

    await this.prisma.application.create({
      data: {
        userId,
        companyName: data.companyName,
        roleTitle: data.jobTitle,
        stage: ApplicationStage.OFFER,
        salaryMin: data.salary ?? undefined,
        location: data.location ?? undefined,
        appliedAt: data.startDate ? new Date(data.startDate) : new Date(),
        events: { create: { toStage: ApplicationStage.OFFER, note: 'Auto-created from offer letter upload' } },
      },
    });
  }

  private async extractLeaseData(userId: string, documentId: string, text: string): Promise<void> {
    const data = await this.aiExtractor.extractLease(text);
    if (!data.leaseEndDate) return;
    await this.immigration.upsertDocumentExpiryDeadline(userId, documentId, DocumentType.LEASE, 'Lease', new Date(data.leaseEndDate));
  }

  private async extractInsuranceData(userId: string, documentId: string, text: string): Promise<void> {
    const data = await this.aiExtractor.extractInsurance(text);
    if (!data.expiryDate) return;
    await this.immigration.upsertDocumentExpiryDeadline(userId, documentId, DocumentType.INSURANCE, 'Health insurance', new Date(data.expiryDate));
  }

  private async extractTaxData(userId: string, text: string): Promise<void> {
    const data = await this.aiExtractor.extractTax(text);
    if (!data.ficaWithheld || data.ficaWithheld <= 0) return;

    const taxYear = data.taxYear ?? new Date().getFullYear() - 1;
    await this.prisma.deadline.upsert({
      where: { userId_dedupeKey: { userId, dedupeKey: `fica-refund-${taxYear}` } },
      create: {
        userId,
        source: DeadlineSource.SYSTEM_GENERATED,
        type: DeadlineType.CUSTOM,
        title: `FICA tax refund, ${taxYear}`,
        dueDate: new Date(`${taxYear + 1}-04-15`),
        dedupeKey: `fica-refund-${taxYear}`,
        notes: `Your W-2 shows $${data.ficaWithheld} in Social Security (FICA) was withheld. F-1 students are exempt from FICA for the first 5 years. You may be eligible for a refund, file Form 843 and 8316 with the IRS.`,
        ruleVersion: 'f1-2026.07',
      },
      update: {},
    });
  }

  async downloadUrl(userId: string, id: string) {
    const doc = await this.findOwned(userId, id);
    if (doc.status !== DocumentStatus.ACTIVE) throw new NotFoundException();
    return { url: await this.storage.presignDownload(doc.storageKey, doc.fileName) };
  }

  async update(userId: string, id: string, dto: UpdateDocumentDto) {
    await this.findOwned(userId, id);
    const updated = await this.prisma.document.update({
      where: { id },
      data: {
        ...(dto.type && { type: dto.type }),
        ...(dto.fileName && { fileName: sanitizeFileName(dto.fileName) }),
        ...(dto.issueDate !== undefined && { issueDate: dto.issueDate ? new Date(dto.issueDate) : null }),
        ...(dto.expiryDate !== undefined && { expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null }),
      },
    });
    if (updated.expiryDate && updated.status === DocumentStatus.ACTIVE) {
      await this.immigration.upsertDocumentExpiryDeadline(
        userId, updated.id, updated.type, updated.fileName, updated.expiryDate,
      );
    }
    return updated;
  }

  /** Soft delete; a purge job removes bytes after 30 days (see docs/DATABASE.md). */
  async remove(userId: string, id: string) {
    await this.findOwned(userId, id);
    await this.prisma.document.update({
      where: { id },
      data: { status: DocumentStatus.DELETED, deletedAt: new Date() },
    });
  }

  private async findOwned(userId: string, id: string) {
    const doc = await this.prisma.document.findFirst({
      where: { id, userId, status: { not: DocumentStatus.DELETED } },
    });
    if (!doc) throw new NotFoundException();
    return doc;
  }
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.\- ()]/g, '_').slice(0, 255);
}

function safeExtension(fileName: string, contentType: string): string {
  const byType: Record<string, string> = {
    'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp',
  };
  return byType[contentType] ?? '';
}
