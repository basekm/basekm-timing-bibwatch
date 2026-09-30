import {
  AnyDirectionValue
} from '@basekm/@shared/constants';
import {
  allTagsOf
} from '@basekm/@shared/utils/sightingTags';
import {
  SightingDto,
  TagsBySightingKey
} from '@basekm/dtos';

export type RunnerListFilters = {
  search: string;
  direction: string;
};

type FilterRunnersParams = {
  sightings: SightingDto[];
  filters: RunnerListFilters;
  tags: TagsBySightingKey;
  registered?: string[];
};

export const filterRunners = ({
  sightings,
  filters,
  tags,
  registered,
}: FilterRunnersParams) => {
  const search = filters.search.trim().toLowerCase();

  return sightings.filter((sighting) => {
    if (filters.direction !== AnyDirectionValue && sighting.direction !== filters.direction) {
      return false;
    }

    if (!search) {
      return true;
    }

    if (sighting.bib.includes(search)) {
      return true;
    }

    return allTagsOf({
      sighting,
      tags,
      registered,
    }).some((tag) => tag.toLowerCase().includes(search));
  });
};
