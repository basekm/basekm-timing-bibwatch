import {
  SightingLabel
} from '@basekm/@shared/constants';
import {
  decideSightings,
  sortSightingsByTime
} from '@basekm/@shared/utils/decideSightings';
import {
  markManualSightings,
  withManualReads
} from '@basekm/@shared/utils/manualReads';
import {
  currentSightingLabel
} from '@basekm/@shared/utils/sightingTags';
import {
  CameraSegmentDto,
  DetectionFrameDto,
  DetectionsDto,
  ManualReadDto,
  SegmentsFileDto,
  SightingDto
} from '@basekm/dtos';

type ScannedRunnersParams = {
  detections: DetectionsDto | null;
  segments: CameraSegmentDto[];
  manualReads: ManualReadDto[];
};

export type ScannedRunners = {
  frames: DetectionFrameDto[];
  targets: Set<string>;
  sightings: SightingDto[];
  crossedBibs: Set<string>;
};

export const toDetections = (json: DetectionsDto | SegmentsFileDto): DetectionsDto => {
  if ('frames' in json && Array.isArray(json.frames)) {
    return {
      ...json,
      frames: [...json.frames].sort((a, b) => a.t - b.t),
    };
  }

  return {
    video: json.video,
    duration: json.duration,
    segments: json.segments ?? [],
    frames: [],
    sightings: [],
    clock: null,
  };
};

const targetsOf = (detections: DetectionsDto | null) => {
  if (detections?.targets) {
    return new Set(detections.targets);
  }

  const targetSightings = (detections?.sightings ?? []).filter((sighting) => sighting.target);
  return new Set(targetSightings.map((sighting) => sighting.bib));
};

export const scannedRunnersOf = ({
  detections,
  segments,
  manualReads,
}: ScannedRunnersParams): ScannedRunners => {
  const scanWithManualReads = withManualReads({
    frames: detections?.frames ?? [],
    coarseHits: detections?.coarseHits,
    manualReads,
  });
  const frames = scanWithManualReads.frames;
  const targets = targetsOf(detections);

  let sightings: SightingDto[] = [];
  if (detections?.coarseHits && scanWithManualReads.coarseHits) {
    const decided = decideSightings({
      coarseHits: scanWithManualReads.coarseHits,
      segments,
      frames,
      targets,
      settings: detections.settings,
    });
    sightings = markManualSightings({
      sightings: decided,
      manualReads,
    });
  } else if (detections) {
    sightings = sortSightingsByTime(detections.sightings ?? []);
  }

  const crossedSightings = sightings.filter((sighting) => currentSightingLabel(sighting) === SightingLabel.Crossed);

  return {
    frames,
    targets,
    sightings,
    crossedBibs: new Set(crossedSightings.map((sighting) => sighting.bib)),
  };
};
