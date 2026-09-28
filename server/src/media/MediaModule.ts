import { Module } from '@nestjs/common';

import { BibwatchModule } from '../bibwatch/BibwatchModule';

import { MediaController } from './MediaController';
import { MediaService } from './MediaService';

@Module({
  imports: [BibwatchModule],
  controllers: [MediaController],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
