import {
  DetectionFrameDto,
  ManualReadDto,
  SightingDto,
  TagsBySightingKey
} from '@basekm/dtos';

import {
  sightingKey
} from './sightingTags';

const TimeTolerance = 0.05;

const isManualRead = (value: unknown): value is ManualReadDto => {
  const read = value as ManualReadDto | null;
  return typeof read?.bib === 'string' && typeof read.t === 'number' && Array.isArray(read.box) && read.box.length === 4;
};

export const manualReadsOf = (tags: TagsBySightingKey): ManualReadDto[] => {
  const reads: unknown = tags.__manualReads;
  return Array.isArray(reads) ? reads.filter(isManualRead) : [];
};

const isReadOf = ({
  read,
  sighting,
}: {
  read: Pick<ManualReadDto, 'bib' | 't'>;
  sighting: Pick<SightingDto, 'bib' | 'from' | 'to'>;
}) => read.bib === sighting.bib && read.t >= sighting.from - TimeTolerance && read.t <= sighting.to + TimeTolerance;

type WithManualReadsParams = {
  frames: DetectionFrameDto[];
  coarseHits: Record<string, number[]> | undefined;
  manualReads: ManualReadDto[];
};

export const withManualReads = ({
  frames,
  coarseHits,
  manualReads,
}: WithManualReadsParams) => {
  if (!manualReads.length) {
    return {
      frames,
      coarseHits,
    };
  }

  const nextFrames = [...frames];
  const nextCoarseHits = {
    ...(coarseHits ?? {}),
  };

  manualReads.forEach((read) => {
    const frameIndex = nextFrames.findIndex((frame) => Math.abs(frame.t - read.t) <= TimeTolerance);
    if (frameIndex < 0) {
      return;
    }

    const frame = nextFrames[frameIndex];
    nextFrames[frameIndex] = {
      ...frame,
      bibs: [...frame.bibs, {
        bib: read.bib,
        box: read.box,
        confidence: 1,
        manual: true,
      }],
    };
    nextCoarseHits[read.bib] = [...(nextCoarseHits[read.bib] ?? []), read.t];
  });

  return {
    frames: nextFrames,
    coarseHits: nextCoarseHits,
  };
};

export const markManualSightings = ({
  sightings,
  manualReads,
}: {
  sightings: SightingDto[];
  manualReads: ManualReadDto[];
}) => {
  if (!manualReads.length) {
    return sightings;
  }

  return sightings.map((sighting) => {
    const isManual = manualReads.some((read) => isReadOf({
      read,
      sighting,
    }));
    return isManual ? {
      ...sighting,
      manual: true,
    } : sighting;
  });
};

export const addManualRead = ({
  tags,
  read,
}: {
  tags: TagsBySightingKey;
  read: ManualReadDto;
}): TagsBySightingKey => ({
  ...tags,
  __manualReads: [...manualReadsOf(tags), read],
} as TagsBySightingKey);

export const removeManualSighting = ({
  tags,
  sighting,
}: {
  tags: TagsBySightingKey;
  sighting: SightingDto;
}): TagsBySightingKey => {
  const next = {
    ...tags,
    __manualReads: manualReadsOf(tags).filter((read) => !isReadOf({
      read,
      sighting,
    })),
  } as TagsBySightingKey;
  delete next[sightingKey(sighting)];

  return next;
};

export const findSightingOfRead = ({
  sightings,
  read,
}: {
  sightings: SightingDto[];
  read: Pick<ManualReadDto, 'bib' | 't'>;
}) => sightings.find((sighting) => isReadOf({
  read,
  sighting,
}));
