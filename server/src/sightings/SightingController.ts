import { BadRequestException, Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';

import { SightingSearchQueryDto } from '../@shared/dto/SightingSearchQueryDto';
import { SightingsSaveRequestDto } from '../@shared/dto/SightingsSaveRequestDto';
import { MediaService } from '../media/MediaService';

import { SightingService } from './SightingService';

@Controller('sightings')
export class SightingController {
  constructor(
    private readonly sightingService: SightingService,
    private readonly mediaService: MediaService,
  ) {}

  /** Where a bib (or tag) was seen, in every video: GET /api/sightings?bib=147 */
  @Get()
  async search(@Query() query: SightingSearchQueryDto) {
    if (!query.isValid) {
      throw new BadRequestException({ error: 'give a bib or a tag to search for' });
    }
    return { sightings: await this.sightingService.search(query) };
  }

  /** The viewer's sightings after a re-sync (mats and camera segments as they are now). */
  @Post()
  @HttpCode(200)
  async save(@Body() body: SightingsSaveRequestDto) {
    await this.mediaService.resolveVideo(body.video);

    return this.sightingService.replaceForVideo(body.video, body.sightings, { duration: body.duration });
  }
}
