import { IsNotEmpty, IsObject, IsString } from 'class-validator';

export class SegmentsSaveRequestDto {
  @IsNotEmpty()
  @IsString()
  video: string;

  /** `{ video, duration, segments: [...] }`, saved as segments.json. */
  @IsObject({ message: 'segments missing' })
  segments: { segments: unknown[] } & Record<string, unknown>;

  constructor(obj?: Partial<SegmentsSaveRequestDto>) {
    Object.assign(this, obj);
  }

  get isValid() {
    return Array.isArray(this.segments?.segments);
  }
}
