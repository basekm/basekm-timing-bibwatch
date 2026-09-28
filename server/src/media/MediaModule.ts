import { Module } from '@nestjs/common';

import { BibwatchModule } from '../bibwatch/BibwatchModule';
import { VideoModule } from '../videos/VideoModule';

import { MediaController } from './MediaController';
import { MediaService } from './MediaService';

@Module({
  imports: [BibwatchModule, VideoModule],
  controllers: [MediaController],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
