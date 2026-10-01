import { IsNotEmpty, IsString } from 'class-validator';

export class FolderOpenRequestDto {
  /** Absolute, or starting with ~/. */
  @IsNotEmpty()
  @IsString()
  path: string;

  constructor(obj?: Partial<FolderOpenRequestDto>) {
    Object.assign(this, obj);
  }
}
