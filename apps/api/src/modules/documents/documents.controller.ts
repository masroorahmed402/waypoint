import { Controller, Get, Post, Patch, Delete, Body, Param, HttpCode } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { DocumentsService } from './documents.service';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { CreateDocumentDto, UpdateDocumentDto } from './dto/document.dto';

@Controller('documents')
export class DocumentsController {
  constructor(private svc: DocumentsService) {}

  @Get()
  list(@CurrentUser() u: JwtUser) { return this.svc.list(u.sub); }

  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Post()
  initiate(@CurrentUser() u: JwtUser, @Body() dto: CreateDocumentDto) {
    return this.svc.initiate(u.sub, dto);
  }

  @Post(':id/confirm')
  confirm(@CurrentUser() u: JwtUser, @Param('id') id: string) {
    return this.svc.confirm(u.sub, id);
  }

  @Post(':id/extract')
  extract(@CurrentUser() u: JwtUser, @Param('id') id: string) {
    return this.svc.extractI20(u.sub, id);
  }

  @Get(':id/download')
  download(@CurrentUser() u: JwtUser, @Param('id') id: string) {
    return this.svc.downloadUrl(u.sub, id);
  }

  @Patch(':id')
  update(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: UpdateDocumentDto) {
    return this.svc.update(u.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() u: JwtUser, @Param('id') id: string) {
    await this.svc.remove(u.sub, id);
  }
}
