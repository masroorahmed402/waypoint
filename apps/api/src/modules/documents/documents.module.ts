import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { StorageModule } from '../storage/storage.module';
import { ImmigrationModule } from '../immigration/immigration.module';
import { EXTRACTOR } from './extraction/i20-extract.type';
import { PdfI20Extractor } from './extraction/pdf-i20.extractor';

@Module({
  imports: [StorageModule, ImmigrationModule],
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    // Free PDF extractor today; swap for an AI extractor later without touching callers.
    { provide: EXTRACTOR, useClass: PdfI20Extractor },
  ],
})
export class DocumentsModule {}
