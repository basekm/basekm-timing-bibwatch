import {
  useMutation,
  UseMutationOptions
} from '@tanstack/react-query';

import {
  SightingsSaveRequestDto
} from '@basekm/dtos';
import {
  PayloadOnly
} from '@basekm/type-utils';

import {
  ApiMutationKeys
} from '../ApiMutationKeys';

import {
  SightingsApi
} from './SightingsApi';

export const SightingsMutations = {
  useSave: (
    options?: Omit<UseMutationOptions<unknown, Error, PayloadOnly<SightingsSaveRequestDto>>, 'mutationKey' | 'mutationFn'>,
  ) => {
    const sightingsSaveMutation = useMutation<unknown, Error, PayloadOnly<SightingsSaveRequestDto>>({
      mutationKey: ApiMutationKeys.Sightings.save(),
      mutationFn: (payload) => SightingsApi.save(payload),
      ...options,
    });

    return {
      sightingsSaveMutation,
    };
  },
};
