import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { EventSettingsEntity } from '../@shared/entities/EventSettingsEntity';

import { EventController } from './EventController';
import { EventService } from './EventService';

@Module({
  imports: [TypeOrmModule.forFeature([EventSettingsEntity])],
  controllers: [EventController],
  providers: [EventService],
  exports: [EventService],
})
export class EventModule {}
