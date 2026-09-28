import { IsNotEmpty, IsString } from 'class-validator';

export class TagsQueryDto {
  @IsNotEmpty()
  @IsString()
  video: string;

  constructor(obj?: Partial<TagsQueryDto>) {
    Object.assign(this, obj);
  }
}
