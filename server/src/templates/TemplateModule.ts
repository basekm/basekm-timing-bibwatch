import { Module } from '@nestjs/common';

import { BibwatchModule } from '../bibwatch/BibwatchModule';
import { EventModule } from '../event/EventModule';
import { MediaModule } from '../media/MediaModule';

import { TemplateController } from './TemplateController';
import { TemplateService } from './TemplateService';

@Module({
  imports: [BibwatchModule, EventModule, MediaModule],
  controllers: [TemplateController],
  providers: [TemplateService],
  exports: [TemplateService],
})
export class TemplateModule {}
