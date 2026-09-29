import {
  DetectionsDto
} from '@basekm/dtos';

export type TimeRange = [number, number];

const MinimumGapSeconds = 1;

export const unscannedRangesOf = ({
  detections,
  duration,
}: {
  detections: DetectionsDto | null;
  duration: number;
}): TimeRange[] => {
  if (!detections?.coarseHits || !Array.isArray(detections.coarseDone) || !duration) {
    return [];
  }

  const scanned = [...detections.coarseDone].sort((a, b) => a[0] - b[0]);
  const gaps: TimeRange[] = [];
  let cursor = 0;

  scanned.forEach(([from, to]) => {
    if (from - cursor > MinimumGapSeconds) {
      gaps.push([cursor, from]);
    }
    cursor = Math.max(cursor, to);
  });

  if (duration - cursor > MinimumGapSeconds) {
    gaps.push([cursor, duration]);
  }

  return gaps;
};
