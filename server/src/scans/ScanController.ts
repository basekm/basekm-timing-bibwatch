import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';

import { ScanClearRequestDto } from '../@shared/dto/ScanClearRequestDto';
import { ScanStartRequestDto } from '../@shared/dto/ScanStartRequestDto';
import { SegmentsSaveRequestDto } from '../@shared/dto/SegmentsSaveRequestDto';
import { TagsSaveRequestDto } from '../@shared/dto/TagsSaveRequestDto';

import { ScanService } from './ScanService';

@Controller()
export class ScanController {
  constructor(private readonly scanService: ScanService) {}

  @Get('scan')
  async getStatus() {
    return this.scanService.getStatus();
  }

  @Post('scan')
  @HttpCode(202)
  async start(@Body() body: ScanStartRequestDto) {
    return this.scanService.start(body);
  }

  @Post('scan/cancel')
  @HttpCode(200)
  async cancel() {
    return this.scanService.cancel();
  }

  @Post('scans/clear')
  @HttpCode(200)
  async clear(@Body() body: ScanClearRequestDto) {
    return this.scanService.clear(body);
  }

  @Post('tags')
  @HttpCode(200)
  async saveTags(@Body() body: TagsSaveRequestDto) {
    return this.scanService.saveTags(body);
  }

  @Post('segments')
  @HttpCode(200)
  async saveSegments(@Body() body: SegmentsSaveRequestDto) {
    return this.scanService.saveSegments(body);
  }
}
