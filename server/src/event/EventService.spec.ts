import 'reflect-metadata';

import { EventSettingsRequestDto } from '../@shared/dto/EventSettingsRequestDto';
import { SightingSearchQueryDto } from '../@shared/dto/SightingSearchQueryDto';
import { ConfigService } from '../config/ConfigService';

import { EventService } from './EventService';

const eventService = new EventService({} as any, { MediaFolder: '/videos/race' } as ConfigService);

describe('EventService.bibArgsOf', () => {
  it('adds no --digits for the classic 4 digits, so earlier scans stay reusable', () => {
    expect(eventService.bibArgsOf({ minDigits: 4, maxDigits: 4, minBib: 1, maxBib: 9999 })).toEqual(['--max-bib', '9999']);
  });

  it('passes mixed lengths and the number range', () => {
    expect(eventService.bibArgsOf({ minDigits: 4, maxDigits: 6, minBib: 1000, maxBib: 999999 }))
      .toEqual(['--digits', '4-6', '--max-bib', '999999', '--min-bib', '1000']);
  });
});

describe('EventSettingsRequestDto', () => {
  it('rejects ranges that are the wrong way round', () => {
    expect(new EventSettingsRequestDto({ minDigits: 4, maxDigits: 6 }).isValid).toBe(true);
    expect(new EventSettingsRequestDto({ minDigits: 6, maxDigits: 4 }).isValid).toBe(false);
    expect(new EventSettingsRequestDto({ minDigits: 4, maxDigits: 6, minBib: 5000, maxBib: 100 }).isValid).toBe(false);
  });
});

describe('searching longer bibs', () => {
  it('finds 5- and 6-digit bibs as typed, short ones padded to 4 as well', () => {
    expect(new SightingSearchQueryDto({ bib: '10523' }).bibCandidates).toEqual(['10523']);
    expect(new SightingSearchQueryDto({ bib: '105230' }).bibCandidates).toEqual(['105230']);
    expect(new SightingSearchQueryDto({ bib: '147' }).bibCandidates).toEqual(['0147', '147']);
  });
});
