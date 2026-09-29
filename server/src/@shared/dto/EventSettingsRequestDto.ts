import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class EventSettingsRequestDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(9)
  minDigits: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(9)
  maxDigits: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minBib: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxBib: number | null;

  constructor(obj?: Partial<EventSettingsRequestDto>) {
    Object.assign(this, obj);

    this.minBib ??= null;
    this.maxBib ??= null;
  }

  get isValid() {
    return this.minDigits <= this.maxDigits && (this.minBib == null || this.maxBib == null || this.minBib <= this.maxBib);
  }
}
