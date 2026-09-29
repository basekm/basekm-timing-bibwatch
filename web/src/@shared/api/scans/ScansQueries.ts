import {
  useQuery,
  UseQueryOptions
} from '@tanstack/react-query';

import {
  ScanStatusGetResponseDto
} from '@basekm/dtos';

import {
  ApiQueryKeys
} from '../ApiQueryKeys';

import {
  ScansApi
} from './ScansApi';

export const ScansQueries = {
  useGetStatus: (
    options?: Omit<UseQueryOptions<ScanStatusGetResponseDto>, 'queryKey' | 'queryFn'>,
  ) => {
    const scanStatusGetQuery = useQuery<ScanStatusGetResponseDto>({
      queryKey: ApiQueryKeys.Scans.getStatus(),
      queryFn: () => ScansApi.getStatus(),
      retry: false,
      ...options,
    });

    return {
      scanStatusGetQuery,
    };
  },
};
