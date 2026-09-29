import {
  EventSettingsGetResponseDto,
  EventSettingsSaveRequestDto
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

export class EventApi extends BaseApi {
  private static baseUrl = `${Environment.ApiBaseUrl}/event`;

  static async getSettings() {
    const response = await super.get({
      url: this.baseUrl,
    });
    return response.json() as Promise<EventSettingsGetResponseDto>;
  }

  static async saveSettings(data: PayloadOnly<EventSettingsSaveRequestDto>) {
    const response = await super.post({
      url: this.baseUrl,
      body: data,
    });
    return response.json() as Promise<EventSettingsGetResponseDto>;
  }
}
