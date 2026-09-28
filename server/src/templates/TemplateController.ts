import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';

import { FinderQueryDto } from '../@shared/dto/FinderQueryDto';
import { TemplateCalibrateRequestDto } from '../@shared/dto/TemplateCalibrateRequestDto';
import { TemplateCreateRequestDto } from '../@shared/dto/TemplateCreateRequestDto';
import { TemplateDeleteRequestDto } from '../@shared/dto/TemplateDeleteRequestDto';

import { TemplateService } from './TemplateService';

@Controller()
export class TemplateController {
  constructor(private readonly templateService: TemplateService) {}

  @Get('templates')
  async getTemplates() {
    return { templates: await this.templateService.getTemplates() };
  }

  @Post('templates')
  @HttpCode(200)
  async create(@Body() body: TemplateCreateRequestDto) {
    return this.templateService.create(body);
  }

  @Post('templates/calibrate')
  @HttpCode(200)
  async calibrate(@Body() body: TemplateCalibrateRequestDto) {
    return this.templateService.calibrate(body);
  }

  @Post('templates/delete')
  @HttpCode(200)
  async delete(@Body() body: TemplateDeleteRequestDto) {
    return this.templateService.delete(body.template);
  }

  @Get('finder')
  async find(@Query() query: FinderQueryDto) {
    return this.templateService.find(query);
  }
}
