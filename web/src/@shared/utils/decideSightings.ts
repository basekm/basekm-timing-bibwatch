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
const SameCrossingSeconds = 1;
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

const mostUsedDesign = ({
  frames,
  bib,
}: {
  frames: DetectionFrameDto[];
  bib: string;
}) => {
  const designCounts: Record<string, number> = {};

  frames.forEach((frame) => {
    frame.bibs.forEach((read) => {
      if (read.bib === bib && read.template) {
        designCounts[read.template] = (designCounts[read.template] || 0) + 1;
      }
    });
  });

  return Object.keys(designCounts).sort((a, b) => designCounts[b] - designCounts[a])[0] ?? null;
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
  sighting.template = mostUsedDesign({
    frames: nearbyFrames,
    bib: window.bib,
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

const markDuplicateCrossings = (sightings: SightingDto[]) => {
  const crossed = sightings
    .filter((sighting) => sighting.label === SightingLabel.Crossed && sighting.cross !== null)
    .sort((a, b) => (a.cross as number) - (b.cross as number));

  for (let index = 0; index < crossed.length;) {
    const group = [crossed[index]];
    while (
      index + group.length < crossed.length
      && (crossed[index + group.length].cross as number) - (group[group.length - 1].cross as number) <= SameCrossingSeconds
    ) {
      group.push(crossed[index + group.length]);
    }

    if (group.length > 1) {
      const fullReadsOf = (sighting: SightingDto) => sighting.fullReads ?? 0;
      const readsOf = (sighting: SightingDto) => sighting.reads ?? 0;
      const kept = group.reduce((best, sighting) => {
        const hasMoreFullReads = fullReadsOf(sighting) > fullReadsOf(best);
        const winsTie = fullReadsOf(sighting) === fullReadsOf(best) && readsOf(sighting) > readsOf(best);
        return hasMoreFullReads || winsTie ? sighting : best;
      });

      group
        .filter((sighting) => sighting !== kept)
        .forEach((sighting) => {
          sighting.label = SightingLabel.Duplicate;
          sighting.note = `same crossing as ${kept.bib} (read as ${sighting.bib})`;
        });
    }

    index += group.length;
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
  const evaluated = windows.map((window) => evaluateWindow({
    window,
    frames,
    targets,
    settings: settings ?? DefaultScanSettings,
  }));

  return sortSightingsByTime(markDuplicateCrossings(evaluated));
};
