import {
  AppBaseDto
} from '../AppBaseDto';

export type Box = [number, number, number, number];

export class FinishLineDto extends AppBaseDto {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export class CameraSegmentDto extends AppBaseDto {
  index: number;
  from: number;
  to: number;
  kind: string;
  refTime?: number;
  mat?: FinishLineDto | null;
}

export class BibReadDto extends AppBaseDto {
  bib: string;
  box: Box;
  confidence: number;
  fragment?: boolean;
  manual?: boolean;
}

export class DetectionFrameDto extends AppBaseDto {
  t: number;
  bibs: BibReadDto[];
  people?: Box[];
}

export class SightingDto extends AppBaseDto {
  bib: string;
  target: boolean;
  segment: number;
  from: number;
  to: number;
  cross: number | null;
  label: string;
  note: string;
  zone: string | null;
  direction: string | null;
  registered?: boolean | null;
  reads?: number;
  fullReads?: number;
  tracked?: number;
  coarseFrames?: number;
  manual?: boolean;
}

export class ScanSettingsDto extends AppBaseDto {
  pad: number;
  fineFps: number;
  reader?: string;
}

export class DetectionsDto extends AppBaseDto {
  video: string | null;
  duration: number | null;
  segments: CameraSegmentDto[];
  frames: DetectionFrameDto[];
  sightings: SightingDto[];
  clock: string | null;
  targets?: string[];
  registered?: string[];
  maxBib?: number;
  scanning?: boolean;
  settings?: ScanSettingsDto;
  coarseHits?: Record<string, number[]>;
  coarseDone?: Array<[number, number]>;
}

export class SegmentsFileDto extends AppBaseDto {
  video: string | null;
  duration: number | null;
  segments: CameraSegmentDto[];
}
