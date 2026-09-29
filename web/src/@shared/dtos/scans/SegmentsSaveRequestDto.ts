import {
  AppBaseDto
} from '../AppBaseDto';
import {
  SegmentsFileDto
} from '../detections/DetectionsDto';

export class SegmentsSaveRequestDto extends AppBaseDto {
  video: string;
  segments: SegmentsFileDto;
}
