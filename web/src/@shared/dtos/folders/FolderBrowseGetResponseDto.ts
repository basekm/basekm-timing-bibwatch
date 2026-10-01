import {
  AppBaseDto
} from '../AppBaseDto';

import {
  FolderDto
} from './FoldersGetResponseDto';

export class FolderBrowseGetRequestDto extends AppBaseDto {
  path?: string;
}

export class FolderBrowseGetResponseDto extends FolderDto {
  parent: string | null;
  folders: FolderDto[];
  videos: string[];
}
