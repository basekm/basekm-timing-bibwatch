import {
  AppBaseDto
} from '../AppBaseDto';

export class EventRegisteredListDto extends AppBaseDto {
  file: string;
  count: number;
  highest: number | null;
}

export class EventSettingsGetResponseDto extends AppBaseDto {
  minDigits: number;
  maxDigits: number;
  minBib: number | null;
  maxBib: number | null;
  registered: EventRegisteredListDto;
}
