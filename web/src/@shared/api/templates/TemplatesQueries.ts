import {
  useQuery,
  UseQueryOptions
} from '@tanstack/react-query';

import {
  TemplateFinderQueryDto,
  TemplateFinderResponseDto,
  TemplateGetResponseDto
} from '@basekm/dtos';
import {
  PayloadOnly
} from '@basekm/type-utils';

import {
  ApiQueryKeys
} from '../ApiQueryKeys';

import {
  TemplatesApi
} from './TemplatesApi';

export const TemplatesQueries = {
  useGetAll: (
    options?: Omit<UseQueryOptions<TemplateGetResponseDto[]>, 'queryKey' | 'queryFn'>,
  ) => {
    const templatesGetAllQuery = useQuery<TemplateGetResponseDto[]>({
      queryKey: ApiQueryKeys.Templates.getAll(),
      queryFn: () => TemplatesApi.getAll(),
      retry: false,
      ...options,
    });

    return {
      templatesGetAllQuery,
    };
  },

  useFind: (
    data: PayloadOnly<TemplateFinderQueryDto>,
    options?: Omit<UseQueryOptions<TemplateFinderResponseDto>, 'queryKey' | 'queryFn'>,
  ) => {
    const templateFinderQuery = useQuery<TemplateFinderResponseDto>({
      queryKey: ApiQueryKeys.Templates.find(data),
      queryFn: () => TemplatesApi.find(data),
      retry: false,
      ...options,
    });

    return {
      templateFinderQuery,
    };
  },
};
