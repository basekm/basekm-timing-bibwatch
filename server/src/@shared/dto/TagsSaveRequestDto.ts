import { IsNotEmpty, IsObject, IsString } from 'class-validator';

export class TagsSaveRequestDto {
  @IsNotEmpty()
  @IsString()
  video: string;

  @IsObject({ message: 'tags missing' })
  tags: Record<string, unknown>;

  constructor(obj?: Partial<TagsSaveRequestDto>) {
    Object.assign(this, obj);
  }
}
