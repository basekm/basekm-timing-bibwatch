import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SightingEntity } from '../@shared/entities/SightingEntity';
import { SightingTagEntity } from '../@shared/entities/SightingTagEntity';
import { DatabaseModule } from '../database/DatabaseModule';
import { MediaModule } from '../media/MediaModule';
import { VideoModule } from '../videos/VideoModule';

import { SightingController } from './SightingController';
import { SightingImportService } from './SightingImportService';
import { SightingService } from './SightingService';
import { TagController } from './TagController';
import { TagService } from './TagService';

@Module({
  imports: [
    TypeOrmModule.forFeature([SightingEntity, SightingTagEntity]),
    DatabaseModule,
    MediaModule,
    VideoModule,
  ],
  controllers: [SightingController, TagController],
  providers: [SightingService, TagService, SightingImportService],
  exports: [SightingService, SightingImportService],
})
export class SightingModule {}
