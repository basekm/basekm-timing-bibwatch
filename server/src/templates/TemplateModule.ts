import { Module } from '@nestjs/common';

import { BibwatchModule } from '../bibwatch/BibwatchModule';
import { MediaModule } from '../media/MediaModule';

import { TemplateController } from './TemplateController';
import { TemplateService } from './TemplateService';

@Module({
  imports: [BibwatchModule, MediaModule],
  controllers: [TemplateController],
  providers: [TemplateService],
  exports: [TemplateService],
})
export class TemplateModule {}
