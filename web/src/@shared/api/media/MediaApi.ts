import {
  DetectionsDto,
  MediaOverviewGetResponseDto,
  SegmentsFileDto,
  VideoClockSaveRequestDto
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

export class MediaApi extends BaseApi {
  private static baseUrl = `${Environment.ApiBaseUrl}/media`;

  static async getOverview() {
    const response = await super.get({
      url: this.baseUrl,
    });
    return response.json() as Promise<MediaOverviewGetResponseDto>;
  }

  static async saveClock(data: PayloadOnly<VideoClockSaveRequestDto>) {
    const response = await super.post({
      url: `${this.baseUrl}/clock`,
      body: data,
    });
    return response.json() as Promise<unknown>;
  }

  static async getDetections(data: PayloadOnly<{ url: string }>) {
    const response = await super.get({
      url: data.url,
      options: {
        cache: 'no-store',
      },
    });
    return response.json() as Promise<DetectionsDto | SegmentsFileDto>;
  }

  static async getSegments(data: PayloadOnly<{ url: string }>) {
    const response = await super.get({
      url: data.url,
      options: {
        cache: 'no-store',
      },
    });
    return response.json() as Promise<SegmentsFileDto>;
  }
}
