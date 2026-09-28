import { Controller, Get } from '@nestjs/common';

import { MediaService } from './MediaService';

@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  /** Videos, JSON files and saved scans in the media folder (the viewer's Library). */
  @Get()
  async getOverview() {
    return this.mediaService.getOverview();
  }
}
