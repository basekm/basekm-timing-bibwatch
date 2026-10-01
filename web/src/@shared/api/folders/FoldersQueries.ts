import {
  keepPreviousData,
  useQuery,
  UseQueryOptions
} from '@tanstack/react-query';

import {
  FolderBrowseGetRequestDto,
  FolderBrowseGetResponseDto,
  FoldersGetResponseDto
} from '@basekm/dtos';
import {
  PayloadOnly
} from '@basekm/type-utils';

import {
  ApiQueryKeys
} from '../ApiQueryKeys';

import {
  FoldersApi
} from './FoldersApi';

export const FoldersQueries = {
  useGetFolders: (
    options?: Omit<UseQueryOptions<FoldersGetResponseDto>, 'queryKey' | 'queryFn'>,
  ) => {
    const foldersGetQuery = useQuery<FoldersGetResponseDto>({
      queryKey: ApiQueryKeys.Folders.getFolders(),
      queryFn: () => FoldersApi.getFolders(),
      retry: false,
      ...options,
    });

    return {
      foldersGetQuery,
    };
  },

  useBrowse: (
    data: PayloadOnly<FolderBrowseGetRequestDto>,
    options?: Omit<UseQueryOptions<FolderBrowseGetResponseDto>, 'queryKey' | 'queryFn'>,
  ) => {
    const folderBrowseGetQuery = useQuery<FolderBrowseGetResponseDto>({
      queryKey: ApiQueryKeys.Folders.browse(data),
      queryFn: () => FoldersApi.browse(data),
      retry: false,
      // Keeps the last folder on screen while the next one loads.
      placeholderData: keepPreviousData,
      ...options,
    });

    return {
      folderBrowseGetQuery,
    };
  },
};
