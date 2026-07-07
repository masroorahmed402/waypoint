import { Controller, Put, Get, Param, Req, Res, NotFoundException, HttpCode } from '@nestjs/common';
import { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { AppConfig } from '../../config/app.config';
import { LocalDiskStorage, decodeStorageKey } from './local.storage';

/**
 * Local development storage endpoint — stands in for S3 presigned PUT/GET so the
 * upload flow works with no AWS credentials. Only active when STORAGE_DRIVER=local.
 * The :seg param is a base64url-encoded storage key (single safe path segment).
 */
@Controller('dev-storage')
export class DevStorageController {
  constructor(private config: AppConfig) {}

  private ensureLocal() {
    if (this.config.storageDriver !== 'local') throw new NotFoundException();
  }

  @Public()
  @Put(':seg')
  @HttpCode(200)
  async put(@Param('seg') seg: string, @Req() req: Request) {
    this.ensureLocal();
    const key = decodeStorageKey(seg);
    const body = req.body as Buffer; // populated by express.raw() (see main.ts)
    if (!Buffer.isBuffer(body)) throw new NotFoundException('No body received');
    await LocalDiskStorage.writeRaw(key, body);
    return { ok: true, bytes: body.length };
  }

  @Public()
  @Get(':seg')
  async get(@Param('seg') seg: string, @Res() res: Response) {
    this.ensureLocal();
    const key = decodeStorageKey(seg);
    try {
      const body = await LocalDiskStorage.readRaw(key);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.send(body);
    } catch {
      throw new NotFoundException();
    }
  }
}
