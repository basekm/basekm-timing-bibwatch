import { ArrayMinSize, IsArray, IsNotEmpty, IsString } from 'class-validator';

export class TemplateCalibrateRequestDto {
  @IsNotEmpty()
  @IsString()
  template: string;

  @IsNotEmpty()
  @IsString()
  video: string;

  /** [video time, x, y] of one clear bib of this design. */
  @IsArray()
  @ArrayMinSize(3)
  at: number[];

  constructor(obj?: Partial<TemplateCalibrateRequestDto>) {
    Object.assign(this, obj);
  }
}
