import {
  AppBaseDto
} from '../AppBaseDto';

export class FolderDto extends AppBaseDto {
  path: string;
  name: string;
}

export class RecentFolderDto extends FolderDto {
  exists: boolean;
}

export class FoldersGetResponseDto extends AppBaseDto {
  current: FolderDto | null;
  recent: RecentFolderDto[];
  places: FolderDto[];
}
