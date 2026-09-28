import { Module } from '@nestjs/common';

import { ConfigModule } from './config/ConfigModule';
import { HealthModule } from './health/HealthModule';
import { MediaModule } from './media/MediaModule';
import { ScanModule } from './scans/ScanModule';
import { TemplateModule } from './templates/TemplateModule';

@Module({
  imports: [
    ConfigModule,
    HealthModule,
    MediaModule,
    ScanModule,
    TemplateModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
