import {
  AppBaseDto
} from '../AppBaseDto';
import {
  Box
} from '../detections/DetectionsDto';

export class TemplateGetResponseDto extends AppBaseDto {
  id: string;
  name: string;
  hue: number | null;
  calibrated: number | string;
  minBib: number;
  maxBib: number | null;
  image: string | null;
}

export class TemplateListResponseDto extends AppBaseDto {
  templates: TemplateGetResponseDto[];
}

export class TemplateCreateRequestDto extends AppBaseDto {
  name: string;
  minBib: number;
  maxBib: number;
  image?: string;
  video?: string;
  at?: number[];
}

export class TemplateCreateResponseDto extends AppBaseDto {
  id: string;
  message: string;
  templates: TemplateGetResponseDto[];
}

export class TemplateCalibrateRequestDto extends AppBaseDto {
  template: string;
  video: string;
  at: number[];
}

export class TemplateCalibrateResponseDto extends AppBaseDto {
  message: string;
  templates: TemplateGetResponseDto[];
}

export class TemplateFinderQueryDto extends AppBaseDto {
  video: string;
  t: number;
  templates: string[];
}

export class TemplateFinderCandidateDto extends AppBaseDto {
  box: Box;
  template: string;
}

export class TemplateFinderReadDto extends AppBaseDto {
  box: Box;
  bib: string;
  template: string;
}

export class TemplateFinderResponseDto extends AppBaseDto {
  candidates: TemplateFinderCandidateDto[];
  reads: TemplateFinderReadDto[];
  ms: number;
}
