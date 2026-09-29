import {
  useQuery,
  UseQueryOptions
} from '@tanstack/react-query';

import {
  EventSettingsGetResponseDto
} from '@basekm/dtos';

import {
  ApiQueryKeys
} from '../ApiQueryKeys';

import {
  EventApi
} from './EventApi';

export const EventQueries = {
  useGetSettings: (
    options?: Omit<UseQueryOptions<EventSettingsGetResponseDto>, 'queryKey' | 'queryFn'>,
  ) => {
    const eventSettingsGetQuery = useQuery<EventSettingsGetResponseDto>({
      queryKey: ApiQueryKeys.Event.getSettings(),
      queryFn: () => EventApi.getSettings(),
      retry: false,
      ...options,
    });

    return {
      eventSettingsGetQuery,
    };
  },
};
