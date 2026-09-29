import { Module } from '@nestjs/common';

import { BibwatchModule } from '../bibwatch/BibwatchModule';
import { EventModule } from '../event/EventModule';
import { MediaModule } from '../media/MediaModule';
import { SightingModule } from '../sightings/SightingModule';
import { TemplateModule } from '../templates/TemplateModule';

import { ScanController } from './ScanController';
import { ScanService } from './ScanService';

@Module({
  imports: [BibwatchModule, EventModule, MediaModule, SightingModule, TemplateModule],
  controllers: [ScanController],
  providers: [ScanService],
})
export class ScanModule {}
