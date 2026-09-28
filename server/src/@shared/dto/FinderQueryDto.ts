import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class FinderQueryDto {
  @IsNotEmpty()
  @IsString()
  video: string;

  /** Comma-separated template ids. */
  @IsNotEmpty()
  @IsString()
  templates: string;

  /** Video time (s) of the frame. */
  @IsOptional()
  @IsString()
  t: string;

  constructor(obj?: Partial<FinderQueryDto>) {
    Object.assign(this, obj);

    this.t ??= '0';
  }

  get templateIds() {
    return this.templates.split(',').filter(Boolean);
  }
}
