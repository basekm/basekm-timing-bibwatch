import { IsOptional, IsString } from 'class-validator';

export class SightingSearchQueryDto {
  /** Bib number; digits are matched with or without leading zeros (147 finds 0147). */
  @IsOptional()
  @IsString()
  bib: string;

  /** An automatic tag (code or name, e.g. "000" or "crossed") or one of your own tags. */
  @IsOptional()
  @IsString()
  tag: string;

  /** Only this video. */
  @IsOptional()
  @IsString()
  video: string;

  constructor(obj?: Partial<SightingSearchQueryDto>) {
    Object.assign(this, obj);
  }

  get isValid() {
    return Boolean(this.bib?.trim() || this.tag?.trim());
  }

  /** The bib as stored (4 digits, zero-padded) plus the text as typed, for fragments like "014". */
  get bibCandidates() {
    const bib = this.bib?.trim();
    if (!bib) {
      return [];
    }
    return /^\d{1,4}$/.test(bib) ? [...new Set([bib.padStart(4, '0'), bib])] : [bib];
  }
}
