import {
  useQuery,
  UseQueryOptions
} from '@tanstack/react-query';

import {
  TagsBySightingKey
} from '@basekm/dtos';
import {
  PayloadOnly
} from '@basekm/type-utils';

import {
  ApiQueryKeys
} from '../ApiQueryKeys';

import {
  TagsApi
} from './TagsApi';

export const TagsQueries = {
  useGetByUrl: (
    data: PayloadOnly<{ url: string }>,
    options?: Omit<UseQueryOptions<TagsBySightingKey>, 'queryKey' | 'queryFn'>,
  ) => {
    const tagsGetQuery = useQuery<TagsBySightingKey>({
      queryKey: ApiQueryKeys.Tags.getByUrl(data),
      queryFn: () => TagsApi.getByUrl(data),
      enabled: Boolean(data.url),
      staleTime: 0,
      ...options,
    });

    return {
      tagsGetQuery,
    };
  },
};
