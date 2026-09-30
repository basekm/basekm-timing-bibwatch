import {
  Box,
  CameraSegmentDto,
  DetectionFrameDto,
  ScanSettingsDto,
  SightingDto
} from '@basekm/dtos';

import {
  RunnerDirection,
  SightingLabel
} from '../constants';

import {
  boxArea,
  boxCenterX,
  boxCenterY,
  finishLineYAt,
  framesWithPeopleBetween,
  isPointInBox,
  segmentAt
} from './frameGeometry';

type ReadWindow = {
  bib: string;
  from: number;
  to: number;
  count: number;
  segment: CameraSegmentDto;
};

type TrackedPerson = {
  box: Box;
  read: boolean;
};

type TrackPoint = {
  t: number;
  x: number;
  depth: number;
};

const SameRunnerGapSeconds = 10;
// Same bib: a misread's reads sit within this time and distance (bib widths/heights) of the
// stronger number's reads. Mirrors SameBib in Sources/bibwatch/Scan.swift.
const SameBibSeconds = 0.6;
const SameBibDistance = 0.75;
const FollowDistance = 0.1;
const DefaultScanSettings: ScanSettingsDto = {
  pad: 4,
  fineFps: 10,
};

const average = (values: number[]) => values.reduce((total, value) => total + value, 0) / values.length;

const buildReadWindows = ({
  coarseHits,
  segments,
}: {
  coarseHits: Record<string, number[]>;
  segments: CameraSegmentDto[];
}): ReadWindow[] => {
  const windows: ReadWindow[] = [];

  for (const [bib, times] of Object.entries(coarseHits)) {
    let current: ReadWindow | null = null;

    for (const time of [...times].sort((a, b) => a - b)) {
      const segment = segmentAt({
        segments,
        time,
      }) as CameraSegmentDto;
      const continuesCurrent = current !== null && time - current.to <= SameRunnerGapSeconds && current.segment.index === segment.index;

      if (continuesCurrent && current) {
        current.to = time;
        current.count += 1;
        continue;
      }

      if (current) {
        windows.push(current);
      }

      current = {
        bib,
        from: time,
        to: time,
        count: 1,
        segment,
      };
    }

    if (current) {
      windows.push(current);
    }
  }

  return windows.sort((a, b) => a.from - b.from);
};

const trackPerson = ({
  frames,
  sighting,
}: {
  frames: DetectionFrameDto[];
  sighting: SightingDto;
}) => {
  const personByFrame = new Map<number, TrackedPerson>();

  frames.forEach((frame, frameIndex) => {
    const hit = frame.bibs.find((read) => read.bib === sighting.bib);
    if (!hit) {
      return;
    }

    sighting.reads = (sighting.reads ?? 0) + 1;
    if (!hit.fragment) {
      sighting.fullReads = (sighting.fullReads ?? 0) + 1;
    }

    const around = (frame.people ?? []).filter((person) => isPointInBox({
      box: person,
      x: boxCenterX(hit.box),
      y: boxCenterY(hit.box),
    }));
    if (around.length) {
      personByFrame.set(frameIndex, {
        box: around.reduce((smallest, person) => (boxArea(person) < boxArea(smallest) ? person : smallest)),
        read: true,
      });
    }
  });

  const follow = (order: number[]) => {
    let last: Box | null = null;

    for (const frameIndex of order) {
      const known = personByFrame.get(frameIndex);
      if (known && known.read) {
        last = known.box;
        continue;
      }

      if (!last) {
        continue;
      }

      const anchor: Box = last;
      const distanceTo = (person: Box) => Math.hypot(boxCenterX(person) - boxCenterX(anchor), person[3] - anchor[3]);
      const people = frames[frameIndex].people ?? [];
      const closest = people.reduce<Box | null>((best, person) => (best === null || distanceTo(person) < distanceTo(best) ? person : best), null);

      if (closest && distanceTo(closest) < FollowDistance) {
        if (!personByFrame.has(frameIndex)) {
          personByFrame.set(frameIndex, {
            box: closest,
            read: false,
          });
        }
        last = closest;
      } else {
        last = null;
      }
    }
  };

  const frameIndexes = frames.map((_, frameIndex) => frameIndex);
  follow(frameIndexes);
  follow([...frameIndexes].reverse());

  return personByFrame;
};

const zoneOf = (depth: number) => {
  if (depth < -0.25) {
    return 'background';
  }

  if (depth < -0.04) {
    return 'before-mat';
  }

  if (depth <= 0.02) {
    return 'on-mat';
  }

  return 'past-mat';
};

const directionOf = (trend: number) => {
  if (trend > 0.03) {
    return RunnerDirection.Toward;
  }

  if (trend < -0.03) {
    return RunnerDirection.Away;
  }

  return RunnerDirection.Still;
};

const findCrossingTime = ({
  track,
  minX,
  maxX,
}: {
  track: TrackPoint[];
  minX: number;
  maxX: number;
}) => {
  let sawBefore = false;

  for (let index = 0; index < track.length; index++) {
    const point = track[index];
    if (point.depth < -0.04) {
      sawBefore = true;
    }

    const isOnLine = point.depth >= 0 && point.x >= minX - 0.02 && point.x <= maxX + 0.02;
    if (sawBefore && index > 0 && isOnLine) {
      const previous = track[index - 1];
      const fraction = (0 - previous.depth) / Math.max(point.depth - previous.depth, 1e-6);
      return previous.t + (point.t - previous.t) * Math.min(Math.max(fraction, 0), 1);
    }
  }

  return null;
};

const evaluateWindow = ({
  window,
  frames,
  targets,
  settings,
}: {
  window: ReadWindow;
  frames: DetectionFrameDto[];
  targets: Set<string>;
  settings: ScanSettingsDto;
}): SightingDto => {
  const sighting: SightingDto = {
    bib: window.bib,
    target: targets.has(window.bib),
    segment: window.segment.index,
    from: window.from,
    to: window.to,
    coarseFrames: window.count,
    label: SightingLabel.Viewed,
    cross: null,
    reads: 0,
    fullReads: 0,
    tracked: 0,
    note: '',
    zone: null,
    direction: null,
  };

  const finishLine = window.segment.mat;
  const from = Math.max(window.segment.from, window.from - settings.pad);
  const to = Math.min(window.segment.to, window.to + settings.pad);
  const nearbyFrames = framesWithPeopleBetween({
    frames,
    from,
    to,
  });

  const expectedFrames = Math.max(1, Math.floor((to - from) * settings.fineFps));
  if (nearbyFrames.length < 0.8 * expectedFrames) {
    sighting.label = SightingLabel.NeedsScan;
    sighting.note = 'not enough frames read here yet — run the scan';
    return sighting;
  }

  const personByFrame = trackPerson({
    frames: nearbyFrames,
    sighting,
  });
  const trackedFrames = [...personByFrame.keys()].sort((a, b) => a - b);
  sighting.tracked = trackedFrames.length;

  const hasReadPerson = [...personByFrame.values()].some((person) => person.read);
  if (sighting.reads === 0 || !hasReadPerson) {
    sighting.note = 'bib read, but no person found around it';
    return sighting;
  }

  const feet = trackedFrames.map((frameIndex) => (personByFrame.get(frameIndex) as TrackedPerson).box[3]);
  const quarter = Math.max(1, Math.floor(feet.length / 4));
  sighting.direction = directionOf(average(feet.slice(-quarter)) - average(feet.slice(0, quarter)));

  if (!finishLine) {
    sighting.note = 'no finish line for this camera position';
    return sighting;
  }

  const depthOf = (box: Box) => box[3] - finishLineYAt({
    finishLine,
    x: boxCenterX(box),
  });
  const track: TrackPoint[] = trackedFrames.map((frameIndex) => {
    const box = (personByFrame.get(frameIndex) as TrackedPerson).box;
    return {
      t: nearbyFrames[frameIndex].t,
      x: boxCenterX(box),
      depth: depthOf(box),
    };
  });

  const readDepths = trackedFrames
    .filter((frameIndex) => (personByFrame.get(frameIndex) as TrackedPerson).read)
    .map((frameIndex) => depthOf((personByFrame.get(frameIndex) as TrackedPerson).box))
    .sort((a, b) => a - b);
  if (readDepths.length) {
    sighting.zone = zoneOf(readDepths[Math.floor(readDepths.length / 2)]);
  }

  sighting.cross = findCrossingTime({
    track,
    minX: Math.min(finishLine.x0, finishLine.x1),
    maxX: Math.max(finishLine.x0, finishLine.x1),
  });

  const nearPoints = track.filter((point) => point.depth >= -0.06);
  const nearTimes = nearPoints.map((point) => point.t);
  const nearSpan = nearPoints.length ? Math.max(...nearTimes) - Math.min(...nearTimes) : 0;
  const deepest = track.length ? Math.max(...track.map((point) => point.depth)) : -1;

  if (sighting.cross !== null) {
    sighting.label = SightingLabel.Crossed;
    if (nearSpan > 5) {
      sighting.note = 'stayed near the finish line afterwards';
    }
    return sighting;
  }

  if (nearPoints.length && nearSpan >= 2) {
    sighting.label = SightingLabel.NearMat;
    sighting.note = 'on or near the finish line without a clear crossing';
    return sighting;
  }

  if (deepest < -0.06) {
    sighting.label = SightingLabel.Passing;
    sighting.note = 'never came close to the finish line';
    return sighting;
  }

  if (track.length < 4) {
    sighting.note = 'too few tracked frames';
  }

  return sighting;
};

// A runner is listed only if their number was read in full at least once: 3-digit fragments
// alone are almost always a covered part of someone's bib or a logo. Mirrors dropFragmentOnly
// in Sources/bibwatch/Scan.swift.
const dropFragmentOnly = ({
  sightings,
  frames,
  pad,
}: {
  sightings: SightingDto[];
  frames: DetectionFrameDto[];
  pad: number;
}) => {
  const fullReadTimes = new Map<string, number[]>();
  frames.forEach((frame) => {
    frame.bibs.forEach((read) => {
      if (!read.fragment) {
        const times = fullReadTimes.get(read.bib) ?? [];
        times.push(frame.t);
        fullReadTimes.set(read.bib, times);
      }
    });
  });

  return sightings.filter((sighting) => sighting.label === SightingLabel.NeedsScan
    || (fullReadTimes.get(sighting.bib) ?? []).some((time) => time >= sighting.from - pad && time <= sighting.to + pad));
};

type TimedRead = {
  t: number;
  box: Box;
  fragment: boolean;
};

const isMisread = ({
  bib,
  of,
  fragment,
}: {
  bib: string;
  of: string;
  fragment: boolean;
}) => {
  if (!fragment && bib.length === of.length) {
    const diff = [...bib].map((_, index) => index).filter((index) => bib[index] !== of[index]);
    if (diff.length === 1) {
      return true;
    }

    return diff.length === 2 && diff[1] === diff[0] + 1 && bib[diff[0]] === of[diff[1]] && bib[diff[1]] === of[diff[0]];
  }

  if (!fragment) {
    return false;
  }

  const raw = bib.replace(/^0+/, '');
  if (raw.length < 2 || raw.length >= of.length) {
    return false;
  }

  for (let start = 0; start <= of.length - raw.length; start++) {
    const different = [...raw].filter((digit, index) => digit !== of[start + index]).length;
    if (different <= 1) {
      return true;
    }
  }

  return false;
};

const compareStrength = (a: SightingDto, b: SightingDto) => {
  const byFullReads = (a.fullReads ?? 0) - (b.fullReads ?? 0);
  if (byFullReads) {
    return byFullReads;
  }

  const byReads = (a.reads ?? 0) - (b.reads ?? 0);
  if (byReads) {
    return byReads;
  }

  if (a.bib !== b.bib) {
    return a.bib < b.bib ? -1 : 1;
  }

  return b.from - a.from;
};

const isSameBibSpot = (a: Box, b: Box) => {
  return Math.abs(boxCenterX(a) - boxCenterX(b)) <= SameBibDistance * Math.max(a[2] - a[0], b[2] - b[0])
    && Math.abs(boxCenterY(a) - boxCenterY(b)) <= SameBibDistance * Math.max(a[3] - a[1], b[3] - b[1]);
};

const foldMisreads = ({
  sightings,
  frames,
  segments,
  pad,
}: {
  sightings: SightingDto[];
  frames: DetectionFrameDto[];
  segments: CameraSegmentDto[];
  pad: number;
}) => {
  const readsByBib = new Map<string, TimedRead[]>();
  frames.forEach((frame) => {
    frame.bibs.forEach((read) => {
      const reads = readsByBib.get(read.bib) ?? [];
      reads.push({
        t: frame.t,
        box: read.box,
        fragment: read.fragment === true,
      });
      readsByBib.set(read.bib, reads);
    });
  });

  const readsOf = (sighting: SightingDto) => (readsByBib.get(sighting.bib) ?? [])
    .filter((read) => read.t >= sighting.from - pad && read.t <= sighting.to + pad);
  // A bib belongs to one runner: every full read of it in this camera position is evidence,
  // including fine-pass reads outside its own sighting.
  const fullReadsOf = (sighting: SightingDto) => {
    const segment = segments.find((candidate) => candidate.index === sighting.segment);
    if (!segment) {
      return [];
    }

    return (readsByBib.get(sighting.bib) ?? []).filter((read) => !read.fragment && read.t >= segment.from && read.t < segment.to);
  };

  for (const sighting of [...sightings].sort(compareStrength)) {
    if (sighting.label === SightingLabel.Duplicate) {
      continue;
    }

    const mine = readsOf(sighting);
    if (!mine.length) {
      continue;
    }

    const isFragment = mine.filter((read) => read.fragment).length * 2 > mine.length;
    const myFullReads = fullReadsOf(sighting).length;
    const owners = sightings.filter((other) => other !== sighting
      && other.label !== SightingLabel.Duplicate
      && other.segment === sighting.segment
      && isMisread({
        bib: sighting.bib,
        of: other.bib,
        fragment: isFragment,
      })
      && fullReadsOf(other).length > myFullReads);

    // A misread spread over several runners of a group still counts once per read.
    const together = new Map<SightingDto, number>();
    let onAny = 0;
    mine.forEach((read) => {
      let hit = false;
      owners.forEach((owner) => {
        const sitsOnOwner = fullReadsOf(owner).some((theirs) => Math.abs(theirs.t - read.t) <= SameBibSeconds
          && isSameBibSpot(theirs.box, read.box));
        if (sitsOnOwner) {
          together.set(owner, (together.get(owner) ?? 0) + 1);
          hit = true;
        }
      });
      if (hit) {
        onAny += 1;
      }
    });

    if (onAny * 2 < mine.length || !together.size) {
      continue;
    }

    const owner = [...together.keys()].reduce((best, candidate) => {
      const byTogether = (together.get(candidate) as number) - (together.get(best) as number);
      return byTogether > 0 || (byTogether === 0 && compareStrength(candidate, best) > 0) ? candidate : best;
    });
    sighting.label = SightingLabel.Duplicate;
    sighting.note = `same runner as ${owner.bib} (read as ${sighting.bib})`;
  }

  return sightings;
};

export const sightingTime = (sighting: Pick<SightingDto, 'cross' | 'from'>) => sighting.cross ?? sighting.from;

export const sortSightingsByTime = (sightings: SightingDto[]) => {
  return [...sightings].sort((a, b) => sightingTime(a) - sightingTime(b));
};

type DecideSightingsParams = {
  coarseHits: Record<string, number[]>;
  segments: CameraSegmentDto[];
  frames: DetectionFrameDto[];
  targets: Set<string>;
  settings?: ScanSettingsDto;
};

export const decideSightings = ({
  coarseHits,
  segments,
  frames,
  targets,
  settings,
}: DecideSightingsParams): SightingDto[] => {
  if (!segments.length) {
    return [];
  }

  const windows = buildReadWindows({
    coarseHits,
    segments,
  });
  const scanSettings = settings ?? DefaultScanSettings;
  const evaluated = windows.map((window) => evaluateWindow({
    window,
    frames,
    targets,
    settings: scanSettings,
  }));

  return sortSightingsByTime(foldMisreads({
    sightings: dropFragmentOnly({
      sightings: evaluated,
      frames,
      pad: scanSettings.pad,
    }),
    frames,
    segments,
    pad: scanSettings.pad,
  }));
};
