import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { ImmigrationModule } from '../immigration/immigration.module';
import { StorageModule } from '../storage/storage.module';
import { AppConfig } from '../../config/app.config';

@Module({
  imports: [ImmigrationModule, StorageModule],
  controllers: [UsersController],
  providers: [UsersService, AppConfig],
})
export class UsersModule {}
