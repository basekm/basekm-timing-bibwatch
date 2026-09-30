import {
  AppBaseDto
} from '../AppBaseDto';

export class SightingSaveItemDto extends AppBaseDto {
  bib: string;
  from: number;
  to: number;
  cross: number | null;
  label: string;
  zone: string | null;
  direction: string | null;
  target: boolean;
  registered: boolean | null;
  reads: number;
  note: string;
}

export class SightingsSaveRequestDto extends AppBaseDto {
  video: string;
  duration: number | null;
  sightings: SightingSaveItemDto[];
}
