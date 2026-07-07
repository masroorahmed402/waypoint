import { Module } from '@nestjs/common';
import { AppConfig } from '../../config/app.config';
import { STORAGE_SERVICE } from './storage.interface';
import { S3Storage } from './s3.storage';
import { LocalDiskStorage } from './local.storage';
import { DevStorageController } from './dev-storage.controller';

@Module({
  controllers: [DevStorageController],
  providers: [
    AppConfig,
    {
      provide: STORAGE_SERVICE,
      inject: [AppConfig],
      useFactory: (config: AppConfig) =>
        config.storageDriver === 's3' ? new S3Storage(config) : new LocalDiskStorage(),
    },
  ],
  exports: [STORAGE_SERVICE],
})
export class StorageModule {}
