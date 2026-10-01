import {
  useQuery,
  UseQueryOptions
} from '@tanstack/react-query';

import {
  DetectionsDto,
  MediaOverviewGetResponseDto,
  SegmentsFileDto
} from '@basekm/dtos';
import {
  PayloadOnly
} from '@basekm/type-utils';

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

  useGetDetections: (
    data: PayloadOnly<{ url: string }>,
    options?: Omit<UseQueryOptions<DetectionsDto | SegmentsFileDto>, 'queryKey' | 'queryFn'>,
  ) => {
    const detectionsGetQuery = useQuery<DetectionsDto | SegmentsFileDto>({
      queryKey: ApiQueryKeys.Media.getDetections(data),
      queryFn: () => MediaApi.getDetections(data),
      enabled: Boolean(data.url),
      staleTime: Infinity,
      ...options,
    });

    return {
      detectionsGetQuery,
    };
  },

  useGetSegments: (
    data: PayloadOnly<{ url: string }>,
    options?: Omit<UseQueryOptions<SegmentsFileDto>, 'queryKey' | 'queryFn'>,
  ) => {
    const segmentsGetQuery = useQuery<SegmentsFileDto>({
      queryKey: ApiQueryKeys.Media.getSegments(data),
      queryFn: () => MediaApi.getSegments(data),
      enabled: Boolean(data.url),
      staleTime: Infinity,
      ...options,
    });

    return {
      segmentsGetQuery,
    };
  },
};
