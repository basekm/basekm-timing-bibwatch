import {
  AppBaseDto
} from '../AppBaseDto';

export class ScanQueueRequestDto extends AppBaseDto {
  /** Scanned one after another, in this order. */
  videos: string[];
}
