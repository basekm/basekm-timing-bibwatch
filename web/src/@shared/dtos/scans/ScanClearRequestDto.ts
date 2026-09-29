import {
  AppBaseDto
} from '../AppBaseDto';

export class ScanClearRequestDto extends AppBaseDto {
  video: string;
  keepSegments: boolean;
}

export class ScanClearResponseDto extends AppBaseDto {
  removed: string[];
}
