import { IsOptional, IsString } from 'class-validator';

export class FolderBrowseQueryDto {
  /** Absolute, or starting with ~/. Default: next to the open folder, else home. */
  @IsOptional()
  @IsString()
  path?: string;

  constructor(obj?: Partial<FolderBrowseQueryDto>) {
    Object.assign(this, obj);
  }
}
