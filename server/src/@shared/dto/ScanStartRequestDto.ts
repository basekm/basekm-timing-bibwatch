import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

export class ScanStartRequestDto {
  @IsNotEmpty()
  @IsString()
  video: string;

  /** Camera segments with mats from the viewer; null = find them first (or reuse the saved ones). */
  @IsOptional()
  @IsObject()
  segments: Record<string, unknown> | null;

  /** Reader time at video 0:00. */
  @IsOptional()
  @IsString()
  clock: string | null;

  /** Template ids to scan with. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  templates: string[];

  /** Video time (s) to start reading from; the scan wraps round to the beginning. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  from: number | null;

  constructor(obj?: Partial<ScanStartRequestDto>) {
    Object.assign(this, obj);
  }
}
