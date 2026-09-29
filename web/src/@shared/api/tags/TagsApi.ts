import {
  TagsBySightingKey,
  TagsSaveRequestDto
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

export class TagsApi extends BaseApi {
  private static baseUrl = `${Environment.ApiBaseUrl}/tags`;

  static async getByUrl(data: PayloadOnly<{ url: string }>) {
    const response = await super.get({
      url: data.url,
      options: {
        cache: 'no-store',
      },
    });
    return response.json() as Promise<TagsBySightingKey>;
  }

  static async save(data: PayloadOnly<TagsSaveRequestDto>) {
    const response = await super.post({
      url: this.baseUrl,
      body: data,
    });
    return response.json() as Promise<unknown>;
  }
}
