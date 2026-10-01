import {
  useQueries,
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

const resultsOfEachVideo = (queries: { data?: SightingSearchResultDto[]; error: Error | null }[]) => ({
  resultsByVideo: queries.map((query) => query.data ?? []),
  errorMessage: queries.find((query) => query.error)?.error?.message ?? null,
});

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

  useGetByVideos: (
    videos: string[],
    options?: Omit<UseQueryOptions<SightingSearchResultDto[]>, 'queryKey' | 'queryFn'>,
  ) => {
    const sightingsByVideo = useQueries({
      combine: resultsOfEachVideo,
      queries: videos.map((video) => ({
        queryKey: ApiQueryKeys.Sightings.search({
          video,
        }),
        queryFn: () => SightingsApi.search({
          video,
        }),
        staleTime: 0,
        ...options,
      })),
    });

    return {
      sightingsByVideo,
    };
  },
};
