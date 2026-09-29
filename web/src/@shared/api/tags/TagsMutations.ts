import {
  useMutation,
  UseMutationOptions
} from '@tanstack/react-query';

import {
  TagsSaveRequestDto
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
  TagsApi
} from './TagsApi';

export const TagsMutations = {
  useSave: (
    options?: Omit<UseMutationOptions<unknown, Error, PayloadOnly<TagsSaveRequestDto>>, 'mutationKey' | 'mutationFn'>,
  ) => {
    const tagsSaveMutation = useMutation<unknown, Error, PayloadOnly<TagsSaveRequestDto>>({
      mutationKey: ApiMutationKeys.Tags.save(),
      mutationFn: (payload) => TagsApi.save(payload),
      ...options,
      onSuccess: (data, variables, onMutateResult, context) => {
        getQueryClient().invalidateQueries({
          queryKey: ApiQueryKeys.Media.getOverview(),
        });
        options?.onSuccess?.(data, variables, onMutateResult, context);
      },
    });

    return {
      tagsSaveMutation,
    };
  },
};
