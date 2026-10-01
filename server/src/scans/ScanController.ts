import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';

import { ScanClearRequestDto } from '../@shared/dto/ScanClearRequestDto';
import { ScanQueueRequestDto } from '../@shared/dto/ScanQueueRequestDto';
import { ScanStartRequestDto } from '../@shared/dto/ScanStartRequestDto';
import { SegmentsSaveRequestDto } from '../@shared/dto/SegmentsSaveRequestDto';

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

  @Post('scan/queue')
  @HttpCode(202)
  async enqueue(@Body() body: ScanQueueRequestDto) {
    return this.scanService.enqueue(body);
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

  @Post('segments')
  @HttpCode(200)
  async saveSegments(@Body() body: SegmentsSaveRequestDto) {
    return this.scanService.saveSegments(body);
  }
}
