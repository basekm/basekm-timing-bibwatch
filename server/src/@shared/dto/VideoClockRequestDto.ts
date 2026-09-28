import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class VideoClockRequestDto {
  @IsNotEmpty()
  @IsString()
  video: string;

  /** Reader time (seconds since midnight) at video 0:00; null clears it. */
  @IsOptional()
  @IsNumber()
  clockOffset: number | null;

  constructor(obj?: Partial<VideoClockRequestDto>) {
    Object.assign(this, obj);

    this.clockOffset ??= null;
  }
}
