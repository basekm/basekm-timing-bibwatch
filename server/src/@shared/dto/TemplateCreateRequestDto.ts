import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsOptional, IsString } from 'class-validator';

/** A new template from bib artwork (`image`, a data URL) or from one bib in the video (`video` + `at`). */
export class TemplateCreateRequestDto {
  @IsOptional()
  @IsString()
  name: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  minBib: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  maxBib: number;

  @IsOptional()
  @IsString()
  image: string;

  @IsOptional()
  @IsString()
  video: string;

  /** [video time, x, y] of the bib number, x/y as frame fractions. */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(3)
  at: number[];

  constructor(obj?: Partial<TemplateCreateRequestDto>) {
    Object.assign(this, obj);
  }
}
