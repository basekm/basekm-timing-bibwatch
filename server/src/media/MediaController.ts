import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';

import { VideoClockRequestDto } from '../@shared/dto/VideoClockRequestDto';
import { VideoService } from '../videos/VideoService';

import { MediaService } from './MediaService';

@Controller('media')
export class MediaController {
  constructor(
    private readonly mediaService: MediaService,
    private readonly videoService: VideoService,
  ) {}

  /** Videos, JSON files and saved scans in the media folder (the viewer's Library). */
  @Get()
  async getOverview() {
    return this.mediaService.getOverview();
  }

  /** Set clock…: reader time at video 0:00, so every sighting of that video gets a reader time. */
  @Post('clock')
  @HttpCode(200)
  async setClock(@Body() body: VideoClockRequestDto) {
    await this.mediaService.resolveVideo(body.video);

    return this.videoService.setClock(body.video, body.clockOffset);
  }
}
