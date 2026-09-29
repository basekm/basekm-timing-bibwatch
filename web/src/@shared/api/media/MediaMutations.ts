import {
  useMutation,
  UseMutationOptions
} from '@tanstack/react-query';

import {
  VideoClockSaveRequestDto
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
  MediaApi
} from './MediaApi';

export const MediaMutations = {
  useSaveClock: (
    options?: Omit<UseMutationOptions<unknown, Error, PayloadOnly<VideoClockSaveRequestDto>>, 'mutationKey' | 'mutationFn'>,
  ) => {
    const videoClockSaveMutation = useMutation<unknown, Error, PayloadOnly<VideoClockSaveRequestDto>>({
      mutationKey: ApiMutationKeys.Media.saveClock(),
      mutationFn: (payload) => MediaApi.saveClock(payload),
      ...options,
      onSuccess: (data, variables, onMutateResult, context) => {
        getQueryClient().invalidateQueries({
          queryKey: ApiQueryKeys.Media.getOverview(),
        });
        options?.onSuccess?.(data, variables, onMutateResult, context);
      },
    });

    return {
      videoClockSaveMutation,
    };
  },
};
