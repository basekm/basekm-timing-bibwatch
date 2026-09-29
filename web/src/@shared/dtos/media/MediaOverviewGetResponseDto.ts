import {
  AppBaseDto
} from '../AppBaseDto';

export class MediaScanFilesDto extends AppBaseDto {
  tags: string | null;
  detections: string | null;
  segments: string | null;
  updated?: number | null;
}

export class MediaOverviewGetResponseDto extends AppBaseDto {
  videos: string[];
  json: string[];
  scans: Record<string, MediaScanFilesDto>;
  targets: boolean;
  scanner: boolean;
  clocks: Record<string, number>;
}
