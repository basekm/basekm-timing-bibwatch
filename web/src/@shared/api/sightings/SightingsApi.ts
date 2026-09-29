import {
  SightingSearchQueryDto,
  SightingSearchResultDto,
  SightingsSaveRequestDto
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

export class SightingsApi extends BaseApi {
  private static baseUrl = `${Environment.ApiBaseUrl}/sightings`;

  static async search(data: PayloadOnly<SightingSearchQueryDto>) {
    const response = await super.get({
      url: this.baseUrl,
      query: {
        bib: data.bib,
        tag: data.tag,
      },
    });
    const body = await response.json() as { sightings: SightingSearchResultDto[] };
    return body.sightings;
  }

  static async save(data: PayloadOnly<SightingsSaveRequestDto>) {
    const response = await super.post({
      url: this.baseUrl,
      body: data,
    });
    return response.json() as Promise<unknown>;
  }
}
