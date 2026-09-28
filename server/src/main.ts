import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';

import { Response } from 'express';

import { AppModule } from './app.module';
import { ConfigService } from './config/ConfigService';

// Everything is re-read on every request: detections.json and segments.json change while the viewer is open.
const noStore = (res: Response) => res.setHeader('Cache-Control', 'no-store');

// Passed through to fs.createReadStream: 1 MB reads instead of 64 KB roughly doubles throughput on big videos.
const videoReadOptions = { highWaterMark: 1024 * 1024 };

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);

  const mediaFolder = configService.MediaFolder;
  if (!mediaFolder) {
    throw new Error('MEDIA_FOLDER is not set: the folder with the videos (see server/.env.example)');
  }

  // Template artwork arrives as a base64 data URL, well over the 100 kB default.
  app.useBodyParser('json', { limit: '50mb' });

  app.setGlobalPrefix('api');

  app.enableShutdownHooks();

  // Errors go back as `{ error }`, the shape the viewer reads.
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      exceptionFactory: (errors) =>
        new BadRequestException({
          error: errors.flatMap((e) => Object.values(e.constraints ?? {})).join('; '),
        }),
    }),
  );

  // Videos, scans and templates. express.static streams files and answers Range requests, so video
  // seeking works. It rejects "../" but follows symlinks placed in the media folder.
  app.useStaticAssets(mediaFolder, {
    ...videoReadOptions,
    prefix: '/media/',
    dotfiles: 'allow',
    index: false,
    redirect: false,
    etag: false,
    lastModified: false,
    setHeaders: noStore,
  });

  app.useStaticAssets(configService.ViewerFolder, {
    index: 'index.html',
    etag: false,
    lastModified: false,
    setHeaders: noStore,
  });

  const port = configService.Port;

  // 127.0.0.1 only, and no CORS: the API starts processes and writes files on this Mac.
  await app.listen(port, '127.0.0.1', () => {
    console.log(`viewer: http://127.0.0.1:${port}/   media: ${mediaFolder}`);
  });
}
bootstrap();
