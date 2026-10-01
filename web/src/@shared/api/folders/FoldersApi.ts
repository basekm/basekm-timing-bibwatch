import {
  FolderBrowseGetRequestDto,
  FolderBrowseGetResponseDto,
  FolderOpenRequestDto,
  FoldersGetResponseDto
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

export class FoldersApi extends BaseApi {
  private static baseUrl = `${Environment.ApiBaseUrl}/folders`;

  static async getFolders() {
    const response = await super.get({
      url: this.baseUrl,
    });
    return response.json() as Promise<FoldersGetResponseDto>;
  }

  static async browse(data: PayloadOnly<FolderBrowseGetRequestDto>) {
    const response = await super.get({
      url: `${this.baseUrl}/browse`,
      query: {
        path: data.path,
      },
    });
    return response.json() as Promise<FolderBrowseGetResponseDto>;
  }

  static async open(data: PayloadOnly<FolderOpenRequestDto>) {
    const response = await super.post({
      url: `${this.baseUrl}/open`,
      body: data,
    });
    return response.json() as Promise<FoldersGetResponseDto>;
  }
}
