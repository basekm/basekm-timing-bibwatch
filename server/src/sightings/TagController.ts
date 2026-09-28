import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';

import { TagsQueryDto } from '../@shared/dto/TagsQueryDto';
import { TagsSaveRequestDto } from '../@shared/dto/TagsSaveRequestDto';
import { MediaService } from '../media/MediaService';

import { TagService, VideoTags } from './TagService';

@Controller('tags')
export class TagController {
  constructor(
    private readonly tagService: TagService,
    private readonly mediaService: MediaService,
  ) {}

  @Get()
  async getTags(@Query() query: TagsQueryDto) {
    await this.mediaService.resolveVideo(query.video);

    return this.tagService.getTags(query.video);
  }

  /** Your own tags on sightings (finisher, spectator, …), saved as you make them. */
  @Post()
  @HttpCode(200)
  async saveTags(@Body() body: TagsSaveRequestDto) {
    await this.mediaService.resolveVideo(body.video);

    return this.tagService.saveTags(body.video, body.tags as VideoTags);
  }
}
