import {
  CameraSegmentDto,
  FinishLineDto
} from '@basekm/dtos';

export const CameraSegmentKind = {
  Fixed: 'fixed',
  Moving: 'moving',
} as const;
export type CameraSegmentKind = (typeof CameraSegmentKind)[keyof typeof CameraSegmentKind];

type CameraSegmentEdit = {
  segments: CameraSegmentDto[];
  focus: CameraSegmentDto;
};

const isSameFinishLine = (first?: FinishLineDto | null, second?: FinishLineDto | null) => {
  if (!first || !second) {
    return false;
  }

  return first.x0 === second.x0 && first.y0 === second.y0 && first.x1 === second.x1 && first.y1 === second.y1;
};

const canJoin = (segment: CameraSegmentDto, neighbour: CameraSegmentDto | undefined) => {
  if (!neighbour || neighbour.kind !== segment.kind) {
    return false;
  }

  if (segment.kind === CameraSegmentKind.Moving) {
    return true;
  }

  return !neighbour.mat || !segment.mat || isSameFinishLine(neighbour.mat, segment.mat);
};

const joinSameKindNeighbours = ({
  segments,
  focus,
}: CameraSegmentEdit): CameraSegmentEdit => {
  const joined = [...segments];
  let focusIndex = joined.indexOf(focus);
  const next = joined[focusIndex + 1];

  if (canJoin(focus, next)) {
    focus.to = next.to;
    focus.mat = focus.mat || next.mat;
    joined.splice(focusIndex + 1, 1);
  }

  focusIndex = joined.indexOf(focus);
  const previous = joined[focusIndex - 1];
  if (canJoin(focus, previous)) {
    previous.to = focus.to;
    previous.mat = previous.mat || focus.mat;
    joined.splice(focusIndex, 1);
    return {
      segments: joined,
      focus: previous,
    };
  }

  return {
    segments: joined,
    focus,
  };
};

const renumber = ({
  segments,
  focus,
}: CameraSegmentEdit): CameraSegmentEdit => {
  segments.forEach((segment, index) => {
    segment.index = index + 1;
  });

  return {
    segments,
    focus,
  };
};

type SplitCameraSegmentParams = {
  segments: CameraSegmentDto[];
  time: number;
  kindAfter?: string;
};

export const splitCameraSegment = ({
  segments,
  time,
  kindAfter,
}: SplitCameraSegmentParams): CameraSegmentEdit | null => {
  const copied = segments.map((segment) => ({
    ...segment,
  }));
  const splitIndex = copied.findIndex((segment) => time >= segment.from && time < segment.to);

  if (splitIndex < 0) {
    return null;
  }

  const segment = copied[splitIndex];
  const kind = kindAfter || segment.kind;
  const kindChanged = kind !== segment.kind;
  const isAtSegmentStart = time - segment.from < 0.25;
  let focus: CameraSegmentDto;

  if (isAtSegmentStart) {
    segment.kind = kind;
    if (kind !== CameraSegmentKind.Fixed) {
      segment.mat = null;
    }
    focus = segment;
  } else {
    const keepsFinishLine = kind === CameraSegmentKind.Fixed && segment.kind === CameraSegmentKind.Fixed;
    focus = {
      index: 0,
      from: time,
      to: segment.to,
      kind,
      refTime: time,
      mat: keepsFinishLine ? segment.mat : null,
    };
    segment.to = time;
    copied.splice(splitIndex + 1, 0, focus);
  }

  if (!kindChanged) {
    return renumber({
      segments: copied,
      focus,
    });
  }

  return renumber(joinSameKindNeighbours({
    segments: copied,
    focus,
  }));
};

type SetFinishLineParams = {
  segments: CameraSegmentDto[];
  segmentIndex: number;
  finishLine: FinishLineDto;
};

export const setFinishLine = ({
  segments,
  segmentIndex,
  finishLine,
}: SetFinishLineParams): CameraSegmentDto[] => {
  return segments.map((segment) => (segment.index === segmentIndex ? {
    ...segment,
    mat: finishLine,
  } : segment));
};
