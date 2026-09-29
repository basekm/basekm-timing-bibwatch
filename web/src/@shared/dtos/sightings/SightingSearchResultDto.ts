import {
  AppBaseDto
} from '../AppBaseDto';

export class SightingSearchResultDto extends AppBaseDto {
  video: string;
  bib: string;
  key: string;
  from: number;
  to: number;
  cross: number | null;
  at: number;
  readerTime: number | null;
  label: string;
  autoTag: string;
  zone: string | null;
  direction: string | null;
  template: string | null;
  target: boolean;
  registered: boolean | null;
  tags: string[];
}

export class SightingSearchQueryDto extends AppBaseDto {
  bib?: string;
  tag?: string;
}
