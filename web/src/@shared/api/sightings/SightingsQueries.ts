import {
  useQuery,
  UseQueryOptions
} from '@tanstack/react-query';

import {
  SightingSearchQueryDto,
  SightingSearchResultDto
} from '@basekm/dtos';
import {
  PayloadOnly
} from '@basekm/type-utils';

import {
  ApiQueryKeys
} from '../ApiQueryKeys';

import {
  SightingsApi
} from './SightingsApi';

export const SightingsQueries = {
  useSearch: (
    data: PayloadOnly<SightingSearchQueryDto>,
    options?: Omit<UseQueryOptions<SightingSearchResultDto[]>, 'queryKey' | 'queryFn'>,
  ) => {
    const sightingsSearchQuery = useQuery<SightingSearchResultDto[]>({
      queryKey: ApiQueryKeys.Sightings.search(data),
      queryFn: () => SightingsApi.search(data),
      enabled: Boolean(data.bib || data.tag),
      staleTime: 0,
      ...options,
    });

    return {
      sightingsSearchQuery,
    };
  },
};
