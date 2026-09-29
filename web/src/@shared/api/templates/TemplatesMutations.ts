import {
  useMutation,
  UseMutationOptions
} from '@tanstack/react-query';

import {
  TemplateCalibrateRequestDto,
  TemplateCalibrateResponseDto,
  TemplateCreateRequestDto,
  TemplateCreateResponseDto,
  TemplateListResponseDto
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
  TemplatesApi
} from './TemplatesApi';

const storeTemplates = (data: { templates: TemplateListResponseDto['templates'] }) => {
  getQueryClient().setQueryData(ApiQueryKeys.Templates.getAll(), data.templates);
};

export const TemplatesMutations = {
  useCreate: (
    options?: Omit<UseMutationOptions<TemplateCreateResponseDto, Error, PayloadOnly<TemplateCreateRequestDto>>, 'mutationKey' | 'mutationFn'>,
  ) => {
    const templateCreateMutation = useMutation<TemplateCreateResponseDto, Error, PayloadOnly<TemplateCreateRequestDto>>({
      mutationKey: ApiMutationKeys.Templates.create(),
      mutationFn: (payload) => TemplatesApi.create(payload),
      ...options,
      onSuccess: (data, variables, onMutateResult, context) => {
        storeTemplates(data);
        options?.onSuccess?.(data, variables, onMutateResult, context);
      },
    });

    return {
      templateCreateMutation,
    };
  },

  useCalibrate: (
    options?: Omit<UseMutationOptions<TemplateCalibrateResponseDto, Error, PayloadOnly<TemplateCalibrateRequestDto>>, 'mutationKey' | 'mutationFn'>,
  ) => {
    const templateCalibrateMutation = useMutation<TemplateCalibrateResponseDto, Error, PayloadOnly<TemplateCalibrateRequestDto>>({
      mutationKey: ApiMutationKeys.Templates.calibrate(),
      mutationFn: (payload) => TemplatesApi.calibrate(payload),
      ...options,
      onSuccess: (data, variables, onMutateResult, context) => {
        storeTemplates(data);
        options?.onSuccess?.(data, variables, onMutateResult, context);
      },
    });

    return {
      templateCalibrateMutation,
    };
  },

  useRemove: (
    options?: Omit<UseMutationOptions<TemplateListResponseDto, Error, PayloadOnly<{ template: string }>>, 'mutationKey' | 'mutationFn'>,
  ) => {
    const templateRemoveMutation = useMutation<TemplateListResponseDto, Error, PayloadOnly<{ template: string }>>({
      mutationKey: ApiMutationKeys.Templates.remove(),
      mutationFn: (payload) => TemplatesApi.remove(payload),
      ...options,
      onSuccess: (data, variables, onMutateResult, context) => {
        storeTemplates(data);
        options?.onSuccess?.(data, variables, onMutateResult, context);
      },
    });

    return {
      templateRemoveMutation,
    };
  },
};
