import { BadRequestException, ValidationError, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';

import * as express from 'express';
import { NextFunction, Request, RequestHandler, Response } from 'express';

import { AppModule } from './app.module';
import { ConfigService } from './config/ConfigService';
import { FolderService } from './folder/FolderService';

// Everything is re-read on every request: detections.json and segments.json change while the viewer is open.
const noStore = (res: Response) => res.setHeader('Cache-Control', 'no-store');

// Passed through to fs.createReadStream: 1 MB reads instead of 64 KB roughly doubles throughput on big videos.
const videoReadOptions = { highWaterMark: 1024 * 1024 };

// Nested DTOs (e.g. each sighting) report their problems under `children`.
const messagesOf = (errors: ValidationError[], parent = ''): string[] =>
  errors.flatMap((error) => {
    const at = parent ? `${parent}.${error.property}` : error.property;
    const own = Object.values(error.constraints ?? {}).map((message) => (parent ? `${at}: ${message}` : message));
    return [...own, ...messagesOf(error.children ?? [], at)];
  });

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  const folderService = app.get(FolderService);

  // A long video's sightings can be well over the 100 kB default body size.
  app.useBodyParser('json', { limit: '50mb' });

  app.setGlobalPrefix('api');

  app.enableShutdownHooks();

  // Errors go back as `{ error }`, the shape the viewer reads.
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      exceptionFactory: (errors) =>
        new BadRequestException({
          error: messagesOf(errors).join('; '),
        }),
    }),
  );

  // Videos and scans of the open folder, at /media/. express.static streams files and answers Range
  // requests, so video seeking works. It rejects "../" but follows symlinks placed in the folder.
  const staticOf = new Map<string, RequestHandler>();
  app.use('/media', (req: Request, res: Response, next: NextFunction) => {
    const folder = folderService.folder;
    // The database lives in the folder; it is read through the API, never served as a file.
    if (!folder || /\.sqlite(-wal|-shm|-journal)?$/i.test(req.path)) {
      return res.sendStatus(404);
    }
    if (!staticOf.has(folder)) {
      staticOf.set(folder, express.static(folder, {
        ...videoReadOptions,
        dotfiles: 'allow',
        index: false,
        redirect: false,
        etag: false,
        lastModified: false,
        setHeaders: noStore,
      }));
    }
    staticOf.get(folder)(req, res, next);
  });

  const port = configService.Port;

  // 127.0.0.1 only, and no CORS: the API starts processes and writes files on this Mac.
  await app.listen(port, '127.0.0.1', () => {
    console.log(`The server is now running at http://127.0.0.1:${port}/api`);
  });
}
bootstrap();
