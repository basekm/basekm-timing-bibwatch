import { Module } from '@nestjs/common';

import { ConfigModule } from './config/ConfigModule';
import { DatabaseModule } from './database/DatabaseModule';
import { EventModule } from './event/EventModule';
import { FolderModule } from './folder/FolderModule';
import { HealthModule } from './health/HealthModule';
import { MediaModule } from './media/MediaModule';
import { ScanModule } from './scans/ScanModule';
import { SightingModule } from './sightings/SightingModule';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    EventModule,
    FolderModule,
    HealthModule,
    MediaModule,
    ScanModule,
    SightingModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
