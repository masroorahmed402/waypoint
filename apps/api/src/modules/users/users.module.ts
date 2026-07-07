import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { ImmigrationModule } from '../immigration/immigration.module';

@Module({
  imports: [ImmigrationModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
