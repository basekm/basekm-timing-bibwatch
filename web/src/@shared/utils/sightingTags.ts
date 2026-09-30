import {
  SightingDto,
  TagsBySightingKey
} from '@basekm/dtos';

import {
  FirstPresetTagCode,
  LegacySightingLabels,
  NotRegisteredTag,
  PresetTags,
  SightingAutoTags
} from '../constants';

export const sightingKey = (sighting: Pick<SightingDto, 'bib' | 'from'>) => `${sighting.bib}@${sighting.from.toFixed(1)}`;

export const currentSightingLabel = (sighting: Pick<SightingDto, 'label'>) => LegacySightingLabels[sighting.label] ?? sighting.label;

export const autoTagOf = (sighting: Pick<SightingDto, 'label'>) => {
  const label = currentSightingLabel(sighting);
  const autoTag = SightingAutoTags[label];

  if (!autoTag) {
    return label;
  }

  if (!autoTag.code) {
    return autoTag.name;
  }

  return `${autoTag.code} ${autoTag.name}`;
};

type TagCodeParams = {
  tags: TagsBySightingKey;
  tag: string;
};

export const tagCodeOf = ({
  tags,
  tag,
}: TagCodeParams) => {
  const presetIndex = PresetTags.indexOf(tag);
  if (presetIndex >= 0) {
    return String(FirstPresetTagCode + presetIndex);
  }

  return tags.__codes?.[tag] ?? '';
};

export const withTagCode = ({
  tags,
  tag,
}: TagCodeParams): TagsBySightingKey => {
  const isKnown = PresetTags.includes(tag) || Boolean(tags.__codes?.[tag]);
  if (isKnown) {
    return tags;
  }

  const codes = {
    ...(tags.__codes ?? {}),
  };
  const usedCodes = new Set(Object.values(codes).map(Number));
  let nextCode = FirstPresetTagCode + PresetTags.length;
  while (usedCodes.has(nextCode)) {
    nextCode++;
  }
  codes[tag] = String(nextCode);

  return {
    ...tags,
    __codes: codes,
  } as TagsBySightingKey;
};

export const labelTag = ({
  tags,
  tag,
}: TagCodeParams) => {
  const code = tagCodeOf({
    tags,
    tag,
  });
  return code ? `${code} ${tag}` : tag;
};

type RegisteredParams = {
  sighting: SightingDto;
  registered?: string[];
};

export const isUnregistered = ({
  sighting,
  registered,
}: RegisteredParams) => {
  if (Array.isArray(registered) && registered.length) {
    return !registered.includes(sighting.bib);
  }

  return sighting.registered === false;
};

export const myTagsOf = ({
  tags,
  sighting,
}: {
  tags: TagsBySightingKey;
  sighting: SightingDto;
}) => tags[sightingKey(sighting)] ?? [];

type AllTagsParams = {
  sighting: SightingDto;
  tags: TagsBySightingKey;
  registered?: string[];
};

export const allTagsOf = ({
  sighting,
  tags,
  registered,
}: AllTagsParams) => {
  const unregisteredTag = isUnregistered({
    sighting,
    registered,
  }) ? NotRegisteredTag : null;
  const myTags = myTagsOf({
    tags,
    sighting,
  }).map((tag) => labelTag({
    tags,
    tag,
  }));

  return [autoTagOf(sighting), unregisteredTag, sighting.zone, sighting.direction, ...myTags]
    .filter((tag): tag is string => Boolean(tag));
};

type ToggleTagParams = {
  tags: TagsBySightingKey;
  key: string;
  tag: string;
};

export const toggleSightingTag = ({
  tags,
  key,
  tag,
}: ToggleTagParams): TagsBySightingKey => {
  const withCode = withTagCode({
    tags,
    tag,
  });
  const current = new Set(withCode[key] ?? []);

  if (current.has(tag)) {
    current.delete(tag);
  } else {
    current.add(tag);
  }

  const next = {
    ...withCode,
  } as TagsBySightingKey;
  if (current.size) {
    next[key] = [...current];
  } else {
    delete next[key];
  }

  return next;
};
