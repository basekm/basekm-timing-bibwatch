import { SightingSearchQueryDto } from './SightingSearchQueryDto';

describe('SightingSearchQueryDto.bibCandidates', () => {
  const candidates = (bib: string) => new SightingSearchQueryDto({ bib }).bibCandidates;

  it('matches digits with or without leading zeros', () => {
    expect(candidates('147')).toEqual(['0147', '147']);
    expect(candidates(' 14 ')).toEqual(['0014', '14']);
  });

  it('keeps a full 4-digit bib as is', () => {
    expect(candidates('0147')).toEqual(['0147']);
  });

  it('needs a bib, a tag or a video', () => {
    expect(new SightingSearchQueryDto({}).isValid).toBe(false);
    expect(new SightingSearchQueryDto({ bib: '  ' }).isValid).toBe(false);
    expect(new SightingSearchQueryDto({ tag: 'finisher' }).isValid).toBe(true);
    expect(new SightingSearchQueryDto({ video: 'GX021737.MP4' }).isValid).toBe(true);
  });
});
