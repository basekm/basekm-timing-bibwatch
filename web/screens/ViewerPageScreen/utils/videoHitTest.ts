import {
  boxArea,
  boxCenterX,
  boxCenterY,
  isPointInBox
} from '@basekm/@shared/utils/frameGeometry';
import {
  Box,
  DetectionFrameDto
} from '@basekm/dtos';

import {
  FramePoint
} from '../hooks/useViewerSession';

export const VideoHitKind = {
  Bib: 'bib',
  Person: 'person',
} as const;

export type VideoHit =
  | { kind: typeof VideoHitKind.Bib; bib: string }
  | { kind: typeof VideoHitKind.Person; box: Box; t: number };

const BibHitMargin = 0.01;

type HitTestParams = {
  frame: DetectionFrameDto | null;
  point: FramePoint;
  isPeopleClickable: boolean;
  isBibClickable: (bib: string) => boolean;
};

export const hitTestFrame = ({
  frame,
  point,
  isPeopleClickable,
  isBibClickable,
}: HitTestParams): VideoHit | null => {
  if (!frame) {
    return null;
  }

  const clickableBibs = frame.bibs.filter((read) => isBibClickable(read.bib));
  const bibRead = clickableBibs.find((read) => isPointInBox({
    box: read.box,
    x: point.x,
    y: point.y,
    margin: BibHitMargin,
  }));
  if (bibRead) {
    return {
      kind: VideoHitKind.Bib,
      bib: bibRead.bib,
    };
  }

  if (!isPeopleClickable) {
    return null;
  }

  const person = (frame.people ?? [])
    .filter((box) => isPointInBox({
      box,
      x: point.x,
      y: point.y,
    }))
    .sort((a, b) => boxArea(a) - boxArea(b))[0];
  if (!person) {
    return null;
  }

  const readOnPerson = clickableBibs.find((read) => isPointInBox({
    box: person,
    x: boxCenterX(read.box),
    y: boxCenterY(read.box),
  }));
  if (readOnPerson) {
    return {
      kind: VideoHitKind.Bib,
      bib: readOnPerson.bib,
    };
  }

  return {
    kind: VideoHitKind.Person,
    box: person,
    t: frame.t,
  };
};
