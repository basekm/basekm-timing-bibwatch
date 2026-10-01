import {
  useMutation,
  UseMutationOptions
} from '@tanstack/react-query';

import {
  FolderOpenRequestDto,
  FoldersGetResponseDto
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
  FoldersApi
} from './FoldersApi';

export const FoldersMutations = {
  useOpen: (
    options?: Omit<UseMutationOptions<FoldersGetResponseDto, Error, PayloadOnly<FolderOpenRequestDto>>, 'mutationKey' | 'mutationFn'>,
  ) => {
    const folderOpenMutation = useMutation<FoldersGetResponseDto, Error, PayloadOnly<FolderOpenRequestDto>>({
      mutationKey: ApiMutationKeys.Folders.open(),
      mutationFn: (payload) => FoldersApi.open(payload),
      ...options,
      onSuccess: (data, variables, onMutateResult, context) => {
        getQueryClient().setQueryData(ApiQueryKeys.Folders.getFolders(), data);
        // Everything else belonged to the folder that was open before.
        getQueryClient().invalidateQueries({
          predicate: (query) => query.queryKey[0] !== 'folders',
        });
        options?.onSuccess?.(data, variables, onMutateResult, context);
      },
    });

    return {
      folderOpenMutation,
    };
  },
};
