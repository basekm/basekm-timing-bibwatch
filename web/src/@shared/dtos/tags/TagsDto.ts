import {
  AppBaseDto
} from '../AppBaseDto';
import {
  Box
} from '../detections/DetectionsDto';

export type ManualReadDto = {
  bib: string;
  t: number;
  box: Box;
};

export type TagsBySightingKey = Record<string, string[]> & {
  __codes?: Record<string, string>;
  __manualReads?: ManualReadDto[];
};

export class TagsSaveRequestDto extends AppBaseDto {
  video: string;
  tags: TagsBySightingKey;
}
