import {
  AppBaseDto
} from '../AppBaseDto';

export type TagsBySightingKey = Record<string, string[]> & {
  __codes?: Record<string, string>;
};

export class TagsSaveRequestDto extends AppBaseDto {
  video: string;
  tags: TagsBySightingKey;
}
