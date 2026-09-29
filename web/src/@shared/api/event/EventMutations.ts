import {
  useMutation,
  UseMutationOptions
} from '@tanstack/react-query';

import {
  EventSettingsGetResponseDto,
  EventSettingsSaveRequestDto
} from '@basekm/dtos';
import {
  getQueryClient
} from '@basekm/lib/queryClient';
import {
  PayloadOnly
} from '@basekm/type-utils';


import {
  ApiMutationKeys
} from '../ApiMutationKeys';
import {
  ApiQueryKeys
} from '../ApiQueryKeys';

import {
  EventApi
} from './EventApi';

export const EventMutations = {
  useSaveSettings: (
    options?: Omit<UseMutationOptions<EventSettingsGetResponseDto, Error, PayloadOnly<EventSettingsSaveRequestDto>>, 'mutationKey' | 'mutationFn'>,
  ) => {
    const eventSettingsSaveMutation = useMutation<EventSettingsGetResponseDto, Error, PayloadOnly<EventSettingsSaveRequestDto>>({
      mutationKey: ApiMutationKeys.Event.saveSettings(),
      mutationFn: (payload) => EventApi.saveSettings(payload),
      ...options,
      onSuccess: (data, variables, onMutateResult, context) => {
        getQueryClient().setQueryData(ApiQueryKeys.Event.getSettings(), data);
        options?.onSuccess?.(data, variables, onMutateResult, context);
      },
    });

    return {
      eventSettingsSaveMutation,
    };
  },
};
