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

  /** The bib as typed, plus zero-padded to 4 (how 4-digit events store "0147"; 147 finds it). */
  get bibCandidates() {
    const bib = this.bib?.trim();
    if (!bib) {
      return [];
    }
    return /^\d{1,3}$/.test(bib) ? [...new Set([bib.padStart(4, '0'), bib])] : [bib];
  }
}
