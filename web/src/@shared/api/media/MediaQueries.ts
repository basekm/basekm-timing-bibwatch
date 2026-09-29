import {
  useQuery,
  UseQueryOptions
} from '@tanstack/react-query';

import {
  MediaOverviewGetResponseDto
} from '@basekm/dtos';

import {
  ApiQueryKeys
} from '../ApiQueryKeys';

import {
  MediaApi
} from './MediaApi';

export const MediaQueries = {
  useGetOverview: (
    options?: Omit<UseQueryOptions<MediaOverviewGetResponseDto>, 'queryKey' | 'queryFn'>,
  ) => {
    const mediaOverviewGetQuery = useQuery<MediaOverviewGetResponseDto>({
      queryKey: ApiQueryKeys.Media.getOverview(),
      queryFn: () => MediaApi.getOverview(),
      retry: false,
      staleTime: Infinity,
      ...options,
    });

    return {
      mediaOverviewGetQuery,
    };
  },
};
