import { Module } from '@nestjs/common';

import { ConfigModule } from './config/ConfigModule';
import { DatabaseModule } from './database/DatabaseModule';
import { EventModule } from './event/EventModule';
import { HealthModule } from './health/HealthModule';
import { MediaModule } from './media/MediaModule';
import { ScanModule } from './scans/ScanModule';
import { SightingModule } from './sightings/SightingModule';
import { TemplateModule } from './templates/TemplateModule';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    EventModule,
    HealthModule,
    MediaModule,
    ScanModule,
    SightingModule,
    TemplateModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
