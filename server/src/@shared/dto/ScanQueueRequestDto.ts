import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class ScanQueueRequestDto {
  /** Videos to scan one after another, in this order. */
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  videos: string[];

  constructor(obj?: Partial<ScanQueueRequestDto>) {
    Object.assign(this, obj);
  }
}
