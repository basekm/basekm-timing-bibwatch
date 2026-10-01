import {
  AppBaseDto
} from '../AppBaseDto';

export class FinishedScanDto extends AppBaseDto {
  video: string;
  state: string;
  message: string;
}

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
  /** Videos waiting to be scanned after this one. */
  queue?: string[];
  /** How each scan since the queue was last empty ended. */
  finished?: FinishedScanDto[];
}
