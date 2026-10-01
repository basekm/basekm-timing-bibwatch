import {
  AppBaseDto
} from '../AppBaseDto';
import {
  FolderDto
} from '../folders/FoldersGetResponseDto';

export class MediaScanFilesDto extends AppBaseDto {
  tags: string | null;
  detections: string | null;
  segments: string | null;
  updated?: number | null;
}

export class MediaOverviewGetResponseDto extends AppBaseDto {
  /** The folder open on the server; null until one is opened (then everything else is empty). */
  folder: FolderDto | null;
  videos: string[];
  json: string[];
  scans: Record<string, MediaScanFilesDto>;
  targets: boolean;
  scanner: boolean;
  clocks: Record<string, number>;
}
