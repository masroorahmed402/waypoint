import { Injectable, Inject, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { STORAGE_SERVICE, StorageService } from '../storage/storage.interface';
import { ImmigrationService } from '../immigration/immigration.service';
import { CreateDocumentDto, UpdateDocumentDto, USER_QUOTA_BYTES } from './dto/document.dto';
import { DocumentStatus, DocumentType } from '@prisma/client';
import { EXTRACTOR, DocumentExtractor, I20Extract } from './extraction/i20-extract.type';

@Injectable()
export class DocumentsService {
  constructor(
    private prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private storage: StorageService,
    @Inject(EXTRACTOR) private extractor: DocumentExtractor,
    private immigration: ImmigrationService,
  ) {}

  /**
   * Read a confirmed I-20 back from storage and extract its fields.
   * Extraction only reads — it never writes to the profile. The caller (web
   * onboarding) shows the result for the user to confirm before saving.
   */
  async extractI20(userId: string, id: string): Promise<I20Extract> {
    const doc = await this.findOwned(userId, id);
    if (doc.type !== DocumentType.I20) {
      throw new BadRequestException('This endpoint only extracts I-20 documents');
    }
    if (doc.contentType !== 'application/pdf') {
      return {
        hasTextLayer: false,
        sevisId: null, surname: null, givenName: null, schoolName: null,
        programOfStudy: null, degreeLevel: null, programStartDate: null,
        programEndDate: null, foundFields: [],
        notice: 'Auto-fill currently supports PDF I-20s only. Please enter your details manually.',
      };
    }
    const bytes = await this.storage.read(doc.storageKey);
    return this.extractor.extractI20(bytes);
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
    if (!head.exists) throw new BadRequestException('Upload not found — retry the upload');
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
    return updated;
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
