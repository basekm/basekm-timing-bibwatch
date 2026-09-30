import {
  SightingDto,
  TagsBySightingKey
} from '@basekm/dtos';

import {
  SightingAutoTags
} from '../constants';

import {
  formatClockTime
} from './formatTime';
import {
  currentSightingLabel,
  isUnregistered,
  labelTag,
  myTagsOf
} from './sightingTags';

const CsvHeader = ['bib', 'target', 'registered', 'segment', 'seen_from', 'seen_to', 'seen_from_reader', 'tag_code', 'tag', 'crossed_at', 'crossed_at_reader', 'zone', 'direction', 'my_tags', 'note'];

const quoteCsv = (value: unknown) => {
  if (value === null || value === undefined) {
    return '';
  }

  const text = String(value);
  if (!/[",\n]/.test(text)) {
    return text;
  }

  return `"${text.replace(/"/g, '""')}"`;
};

type BuildSightingsCsvParams = {
  sightings: SightingDto[];
  tags: TagsBySightingKey;
  registered?: string[];
  clockOffset: number | null;
};

export const buildSightingsCsv = ({
  sightings,
  tags,
  registered,
  clockOffset,
}: BuildSightingsCsvParams) => {
  const readerTime = (seconds: number | null) => {
    if (seconds === null || clockOffset === null) {
      return '';
    }
    return formatClockTime(clockOffset + seconds);
  };
  const hasRegistrationInfo = (sighting: SightingDto) => Boolean(registered?.length) || (sighting.registered !== null && sighting.registered !== undefined);

  const rows = sightings.map((sighting) => {
    const label = currentSightingLabel(sighting);
    const autoTag = SightingAutoTags[label] ?? {
      code: '',
      name: label,
    };
    const unregistered = isUnregistered({
      sighting,
      registered,
    });
    const registeredColumn = (unregistered && 'no') || (hasRegistrationInfo(sighting) && 'yes') || '';
    const myTags = myTagsOf({
      tags,
      sighting,
    }).map((tag) => labelTag({
      tags,
      tag,
    })).join('; ');

    return [
      sighting.bib,
      sighting.target ? 'yes' : '',
      registeredColumn,
      sighting.segment,
      formatClockTime(sighting.from),
      formatClockTime(sighting.to),
      readerTime(sighting.from),
      autoTag.code,
      autoTag.name,
      sighting.cross !== null ? formatClockTime(sighting.cross) : '',
      readerTime(sighting.cross),
      sighting.zone || '',
      sighting.direction || '',
      myTags,
      sighting.note || '',
    ];
  });

  return [CsvHeader, ...rows].map((row) => row.map(quoteCsv).join(',')).join('\n') + '\n';
};
