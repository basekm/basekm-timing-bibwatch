import {
  AnyDirectionValue,
  RunnerListFilter,
  SightingLabel
} from '@basekm/@shared/constants';
import {
  allTagsOf,
  currentSightingLabel
} from '@basekm/@shared/utils/sightingTags';
import {
  SightingDto,
  TagsBySightingKey
} from '@basekm/dtos';

export type RunnerListFilters = {
  filter: RunnerListFilter;
  search: string;
  direction: string;
};

type FilterRunnersParams = {
  sightings: SightingDto[];
  filters: RunnerListFilters;
  tags: TagsBySightingKey;
  registered?: string[];
};

const matchesFilter = (sighting: SightingDto, filter: RunnerListFilter) => {
  const isFinished = currentSightingLabel(sighting) === SightingLabel.Crossed;

  if (filter === RunnerListFilter.Finished) {
    return isFinished;
  }

  if (filter === RunnerListFilter.Watchlist) {
    return sighting.target;
  }

  if (filter === RunnerListFilter.NotFinished) {
    return !isFinished;
  }

  return true;
};

export const filterRunners = ({
  sightings,
  filters,
  tags,
  registered,
}: FilterRunnersParams) => {
  const search = filters.search.trim().toLowerCase();

  return sightings.filter((sighting) => {
    if (!matchesFilter(sighting, filters.filter)) {
      return false;
    }

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
