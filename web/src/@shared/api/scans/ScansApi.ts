import {
  ScanClearRequestDto,
  ScanClearResponseDto,
  ScanQueueRequestDto,
  ScanStartRequestDto,
  ScanStatusGetResponseDto,
  SegmentsSaveRequestDto
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

export class ScansApi extends BaseApi {
  private static baseUrl = Environment.ApiBaseUrl;

  static async getStatus() {
    const response = await super.get({
      url: `${this.baseUrl}/scan`,
    });
    return response.json() as Promise<ScanStatusGetResponseDto>;
  }

  static async start(data: PayloadOnly<ScanStartRequestDto>) {
    const response = await super.post({
      url: `${this.baseUrl}/scan`,
      body: data,
    });
    return response.json() as Promise<ScanStatusGetResponseDto>;
  }

  static async enqueue(data: PayloadOnly<ScanQueueRequestDto>) {
    const response = await super.post({
      url: `${this.baseUrl}/scan/queue`,
      body: data,
    });
    return response.json() as Promise<ScanStatusGetResponseDto>;
  }

  static async cancel() {
    const response = await super.post({
      url: `${this.baseUrl}/scan/cancel`,
      body: {},
    });
    return response.json() as Promise<ScanStatusGetResponseDto>;
  }

  static async clear(data: PayloadOnly<ScanClearRequestDto>) {
    const response = await super.post({
      url: `${this.baseUrl}/scans/clear`,
      body: data,
    });
    return response.json() as Promise<ScanClearResponseDto>;
  }

  static async saveSegments(data: PayloadOnly<SegmentsSaveRequestDto>) {
    const response = await super.post({
      url: `${this.baseUrl}/segments`,
      body: data,
    });
    return response.json() as Promise<unknown>;
  }
}
