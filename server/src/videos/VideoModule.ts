import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { VideoEntity } from '../@shared/entities/VideoEntity';

import { VideoService } from './VideoService';

@Module({
  imports: [TypeOrmModule.forFeature([VideoEntity])],
  providers: [VideoService],
  exports: [VideoService],
})
export class VideoModule {}
