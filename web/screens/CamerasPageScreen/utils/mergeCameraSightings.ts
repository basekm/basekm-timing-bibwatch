import {
  SightingDto,
  SightingSearchResultDto
} from '@basekm/dtos';

export type CameraSighting = {
  key: string;
  video: string;
  raceTime: number;
  clockOffset: number;
  sighting: SightingDto;
  tags: string[];
  isUnregistered: boolean;
};

type MergeCameraSightingsParams = {
  resultsByVideo: SightingSearchResultDto[][];
  clocks: Record<string, number>;
};

const toSighting = (result: SightingSearchResultDto): SightingDto => ({
  bib: result.bib,
  target: result.target,
  segment: 0,
  from: result.from,
  to: result.to,
  cross: result.cross,
  label: result.label,
  note: '',
  zone: result.zone,
  direction: result.direction,
  registered: result.registered,
});

export const mergeCameraSightings = ({
  resultsByVideo,
  clocks,
}: MergeCameraSightingsParams): CameraSighting[] => {
  const cameraSightings = resultsByVideo.flat().flatMap((result) => {
    const clockOffset = clocks[result.video];

    if (clockOffset === undefined) {
      return [];
    }

    return [{
      key: `${result.video}|${result.key}`,
      video: result.video,
      raceTime: clockOffset + result.at,
      clockOffset,
      sighting: toSighting(result),
      tags: result.tags,
      isUnregistered: result.registered === false,
    }];
  });

  return cameraSightings.sort((a, b) => a.raceTime - b.raceTime || a.video.localeCompare(b.video));
};
