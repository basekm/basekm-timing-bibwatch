import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';

import { FolderBrowseQueryDto } from '../@shared/dto/FolderBrowseQueryDto';
import { FolderOpenRequestDto } from '../@shared/dto/FolderOpenRequestDto';

import { FolderService } from './FolderService';

@Controller('folders')
export class FolderController {
  constructor(private readonly folderService: FolderService) {}

  /** The open folder, recently opened ones and places to start browsing from. */
  @Get()
  async getFolders() {
    return this.folderService.getFolders();
  }

  /** One folder's sub-folders and videos, for the Open folder dialog. */
  @Get('browse')
  async browse(@Query() query: FolderBrowseQueryDto) {
    return this.folderService.browse(query.path);
  }

  /** Work in this folder from now on (refused while a scan is running). */
  @Post('open')
  @HttpCode(200)
  async open(@Body() body: FolderOpenRequestDto) {
    return this.folderService.open(body.path);
  }
}
