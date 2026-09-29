import {
  AppBaseDto
} from '../AppBaseDto';

export class ScanStatusGetResponseDto extends AppBaseDto {
  state: string;
  video?: string;
  phase?: string | null;
  done?: number;
  total?: number;
  eta?: number | null;
  at?: number | null;
  message?: string;
  summary?: string;
  elapsed?: number;
  checkpoint?: number | null;
  partial?: string | null;
  result?: string | null;
}
