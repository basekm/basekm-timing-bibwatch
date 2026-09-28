import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ScanClearRequestDto {
  @IsNotEmpty()
  @IsString()
  video: string;

  /** Keep the user's mats / camera-segment edits (segments.json). */
  @IsOptional()
  @IsBoolean()
  keepSegments: boolean;

  constructor(obj?: Partial<ScanClearRequestDto>) {
    Object.assign(this, obj);

    this.keepSegments ??= true;
  }
}
