import {
  AppBaseDto
} from '../AppBaseDto';
import {
  SegmentsFileDto
} from '../detections/DetectionsDto';

export class ScanStartRequestDto extends AppBaseDto {
  video: string;
  segments: SegmentsFileDto | null;
  clock: string | null;
  templates: string[];
  from: number | null;
  peopleFirst: boolean;
}
