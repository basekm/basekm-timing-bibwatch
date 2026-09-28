import { IsNotEmpty, IsString } from 'class-validator';

export class TemplateDeleteRequestDto {
  @IsNotEmpty()
  @IsString()
  template: string;

  constructor(obj?: Partial<TemplateDeleteRequestDto>) {
    Object.assign(this, obj);
  }
}
