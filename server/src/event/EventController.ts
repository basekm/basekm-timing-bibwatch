import { BadRequestException, Body, Controller, Get, HttpCode, Post } from '@nestjs/common';

import { EventSettingsRequestDto } from '../@shared/dto/EventSettingsRequestDto';

import { EventService } from './EventService';

/** The event = this media folder: its bib rules, saved in its database. */
@Controller('event')
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @Get()
  async getSettings() {
    return this.eventService.getSettings();
  }

  @Post()
  @HttpCode(200)
  async saveSettings(@Body() body: EventSettingsRequestDto) {
    if (!body.isValid) {
      throw new BadRequestException({ error: 'fewest digits must not be more than most digits, and lowest bib not above highest' });
    }
    return this.eventService.saveSettings(body);
  }
}
