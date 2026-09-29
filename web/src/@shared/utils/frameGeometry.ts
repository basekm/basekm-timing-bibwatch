import {
  Box,
  CameraSegmentDto,
  DetectionFrameDto,
  FinishLineDto
} from '@basekm/dtos';

export const boxCenterX = (box: Box) => (box[0] + box[2]) / 2;

export const boxCenterY = (box: Box) => (box[1] + box[3]) / 2;

export const boxArea = (box: Box) => (box[2] - box[0]) * (box[3] - box[1]);

type PointInBoxParams = {
  box: Box;
  x: number;
  y: number;
  margin?: number;
};

export const isPointInBox = ({
  box,
  x,
  y,
  margin = 0,
}: PointInBoxParams) => {
  return x >= box[0] - margin && x <= box[2] + margin && y >= box[1] - margin && y <= box[3] + margin;
};

type FinishLineYParams = {
  finishLine: FinishLineDto;
  x: number;
};

export const finishLineYAt = ({
  finishLine,
  x,
}: FinishLineYParams) => {
  if (finishLine.x1 === finishLine.x0) {
    return (finishLine.y0 + finishLine.y1) / 2;
  }

  const fraction = Math.min(Math.max((x - finishLine.x0) / (finishLine.x1 - finishLine.x0), 0), 1);
  return finishLine.y0 + (finishLine.y1 - finishLine.y0) * fraction;
};

type SegmentAtParams = {
  segments: CameraSegmentDto[];
  time: number;
};

export const segmentAt = ({
  segments,
  time,
}: SegmentAtParams): CameraSegmentDto | null => {
  const containing = segments.find((segment) => time >= segment.from && time < segment.to);
  return containing ?? segments[segments.length - 1] ?? null;
};

type NearestFrameParams = {
  frames: DetectionFrameDto[];
  time: number;
};

export const nearestFrame = ({
  frames,
  time,
}: NearestFrameParams): DetectionFrameDto | null => {
  if (!frames.length) {
    return null;
  }

  let low = 0;
  let high = frames.length - 1;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (frames[middle].t < time) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  const candidates = [frames[low], frames[low - 1]].filter(Boolean);
  const best = candidates.reduce((closest, frame) => (Math.abs(closest.t - time) <= Math.abs(frame.t - time) ? closest : frame));
  const tolerance = best.people ? 0.15 : 0.35;

  return Math.abs(best.t - time) <= tolerance ? best : null;
};

type FramesBetweenParams = {
  frames: DetectionFrameDto[];
  from: number;
  to: number;
};

export const framesWithPeopleBetween = ({
  frames,
  from,
  to,
}: FramesBetweenParams): DetectionFrameDto[] => {
  let low = 0;
  let high = frames.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (frames[middle].t < from - 1e-6) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  const found: DetectionFrameDto[] = [];
  for (let index = low; index < frames.length && frames[index].t <= to + 1e-6; index++) {
    if (frames[index].people) {
      found.push(frames[index]);
    }
  }

  return found;
};
