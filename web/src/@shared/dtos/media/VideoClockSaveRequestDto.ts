import {
  AppBaseDto
} from '../AppBaseDto';

export class VideoClockSaveRequestDto extends AppBaseDto {
  video: string;
  clockOffset: number;
}
