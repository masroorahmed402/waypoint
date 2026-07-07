import { IsString, IsEnum, IsInt, IsOptional, IsISO8601, Max, Min, MaxLength, IsIn } from 'class-validator';
import { DocumentType } from '@prisma/client';

export const ALLOWED_CONTENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
export const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB
export const USER_QUOTA_BYTES = 500 * 1024 * 1024; // 500 MB

export class CreateDocumentDto {
  @IsEnum(DocumentType) type: DocumentType;
  @IsString() @MaxLength(255) fileName: string;
  @IsIn(ALLOWED_CONTENT_TYPES) contentType: string;
  @IsInt() @Min(1) @Max(MAX_FILE_BYTES) sizeBytes: number;
  @IsOptional() @IsISO8601() issueDate?: string;
  @IsOptional() @IsISO8601() expiryDate?: string;
}

export class UpdateDocumentDto {
  @IsOptional() @IsEnum(DocumentType) type?: DocumentType;
  @IsOptional() @IsString() @MaxLength(255) fileName?: string;
  @IsOptional() @IsISO8601() issueDate?: string;
  @IsOptional() @IsISO8601() expiryDate?: string;
}
