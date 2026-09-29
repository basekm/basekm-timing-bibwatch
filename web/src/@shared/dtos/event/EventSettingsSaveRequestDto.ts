import {
  AppBaseDto
} from '../AppBaseDto';

export class EventSettingsSaveRequestDto extends AppBaseDto {
  minDigits: number;
  maxDigits: number;
  minBib: number | null;
  maxBib: number | null;
}
