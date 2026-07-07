import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { raw } from 'express';
import { AppModule } from './app.module';
import { AppConfig } from './config/app.config';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(AppConfig);

  app.use(helmet());
  app.use(cookieParser());
  // Dev-storage receives raw file bytes (stand-in for S3 presigned PUT). Scope the
  // raw parser to that path only so JSON parsing everywhere else is untouched.
  app.use('/api/v1/dev-storage', raw({ type: () => true, limit: '25mb' }));
  app.enableCors({ origin: config.webOrigin, credentials: true });

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.enableShutdownHooks();

  const doc = new DocumentBuilder()
    .setTitle('Waypoint API')
    .setVersion('0.1')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, doc));

  await app.listen(config.port);
  // eslint-disable-next-line no-console
  console.log(`Waypoint API on :${config.port} — docs at /api/docs`);
}
bootstrap();
