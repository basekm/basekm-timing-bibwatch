import {
  TemplateCalibrateRequestDto,
  TemplateCalibrateResponseDto,
  TemplateCreateRequestDto,
  TemplateCreateResponseDto,
  TemplateFinderQueryDto,
  TemplateFinderResponseDto,
  TemplateListResponseDto
} from '@basekm/dtos';
import {
  Environment
} from '@basekm/envs';
import {
  PayloadOnly
} from '@basekm/type-utils';

import {
  BaseApi
} from '../BaseApi';

export class TemplatesApi extends BaseApi {
  private static baseUrl = Environment.ApiBaseUrl;

  static async getAll() {
    const response = await super.get({
      url: `${this.baseUrl}/templates`,
    });
    const body = await response.json() as TemplateListResponseDto;
    return body.templates;
  }

  static async create(data: PayloadOnly<TemplateCreateRequestDto>) {
    const response = await super.post({
      url: `${this.baseUrl}/templates`,
      body: data,
    });
    return response.json() as Promise<TemplateCreateResponseDto>;
  }

  static async calibrate(data: PayloadOnly<TemplateCalibrateRequestDto>) {
    const response = await super.post({
      url: `${this.baseUrl}/templates/calibrate`,
      body: data,
    });
    return response.json() as Promise<TemplateCalibrateResponseDto>;
  }

  static async remove(data: PayloadOnly<{ template: string }>) {
    const response = await super.post({
      url: `${this.baseUrl}/templates/delete`,
      body: data,
    });
    return response.json() as Promise<TemplateListResponseDto>;
  }

  static async find(data: PayloadOnly<TemplateFinderQueryDto>) {
    const response = await super.get({
      url: `${this.baseUrl}/finder`,
      query: {
        video: data.video,
        t: data.t,
        templates: data.templates.join(','),
      },
    });
    return response.json() as Promise<TemplateFinderResponseDto>;
  }
}
