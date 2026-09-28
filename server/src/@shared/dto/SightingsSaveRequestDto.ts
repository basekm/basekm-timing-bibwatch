import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

/** One sighting as the viewer (and detections.json) describe it. */
export class SightingDto {
  @IsNotEmpty()
  @IsString()
  bib: string;

  @IsNumber()
  from: number;

  @IsNumber()
  to: number;

  @IsOptional()
  @IsNumber()
  cross: number | null;

  @IsNotEmpty()
  @IsString()
  label: string;

  @IsOptional()
  @IsString()
  zone: string | null;

  @IsOptional()
  @IsString()
  direction: string | null;

  @IsOptional()
  @IsString()
  template: string | null;

  @IsOptional()
  @IsBoolean()
  target: boolean;

  @IsOptional()
  @IsBoolean()
  registered: boolean | null;

  @IsOptional()
  @IsNumber()
  reads: number;

  @IsOptional()
  @IsString()
  note: string;

  constructor(obj?: Partial<SightingDto>) {
    Object.assign(this, obj);
  }
}

/** The viewer's sightings for one video after a re-sync: they replace what is stored. */
export class SightingsSaveRequestDto {
  @IsNotEmpty()
  @IsString()
  video: string;

  @IsOptional()
  @IsNumber()
  duration: number | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SightingDto)
  sightings: SightingDto[];

  constructor(obj?: Partial<SightingsSaveRequestDto>) {
    Object.assign(this, obj);
  }
}
