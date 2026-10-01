import {
  useMutation,
  UseMutationOptions
} from '@tanstack/react-query';

import {
  ScanClearRequestDto,
  ScanClearResponseDto,
  ScanQueueRequestDto,
  ScanStartRequestDto,
  ScanStatusGetResponseDto,
  SegmentsSaveRequestDto
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
  ScansApi
} from './ScansApi';

const refreshScanStatus = () => {
  getQueryClient().invalidateQueries({
    queryKey: ApiQueryKeys.Scans.getStatus(),
  });
};

const refreshMediaOverview = () => {
  getQueryClient().invalidateQueries({
    queryKey: ApiQueryKeys.Media.getOverview(),
  });
};

export const ScansMutations = {
  useStart: (
    options?: Omit<UseMutationOptions<ScanStatusGetResponseDto, Error, PayloadOnly<ScanStartRequestDto>>, 'mutationKey' | 'mutationFn'>,
  ) => {
    const scanStartMutation = useMutation<ScanStatusGetResponseDto, Error, PayloadOnly<ScanStartRequestDto>>({
      mutationKey: ApiMutationKeys.Scans.start(),
      mutationFn: (payload) => ScansApi.start(payload),
      ...options,
      onSuccess: (data, variables, onMutateResult, context) => {
        refreshScanStatus();
        options?.onSuccess?.(data, variables, onMutateResult, context);
      },
    });

    return {
      scanStartMutation,
    };
  },

  useEnqueue: (
    options?: Omit<UseMutationOptions<ScanStatusGetResponseDto, Error, PayloadOnly<ScanQueueRequestDto>>, 'mutationKey' | 'mutationFn'>,
  ) => {
    const scanEnqueueMutation = useMutation<ScanStatusGetResponseDto, Error, PayloadOnly<ScanQueueRequestDto>>({
      mutationKey: ApiMutationKeys.Scans.enqueue(),
      mutationFn: (payload) => ScansApi.enqueue(payload),
      ...options,
      onSuccess: (data, variables, onMutateResult, context) => {
        refreshScanStatus();
        options?.onSuccess?.(data, variables, onMutateResult, context);
      },
    });

    return {
      scanEnqueueMutation,
    };
  },

  useCancel: (
    options?: Omit<UseMutationOptions<ScanStatusGetResponseDto, Error, void>, 'mutationKey' | 'mutationFn'>,
  ) => {
    const scanCancelMutation = useMutation<ScanStatusGetResponseDto, Error, void>({
      mutationKey: ApiMutationKeys.Scans.cancel(),
      mutationFn: () => ScansApi.cancel(),
      ...options,
      onSuccess: (data, variables, onMutateResult, context) => {
        refreshScanStatus();
        options?.onSuccess?.(data, variables, onMutateResult, context);
      },
    });

    return {
      scanCancelMutation,
    };
  },

  useClear: (
    options?: Omit<UseMutationOptions<ScanClearResponseDto, Error, PayloadOnly<ScanClearRequestDto>>, 'mutationKey' | 'mutationFn'>,
  ) => {
    const scanClearMutation = useMutation<ScanClearResponseDto, Error, PayloadOnly<ScanClearRequestDto>>({
      mutationKey: ApiMutationKeys.Scans.clear(),
      mutationFn: (payload) => ScansApi.clear(payload),
      ...options,
      onSuccess: (data, variables, onMutateResult, context) => {
        refreshMediaOverview();
        options?.onSuccess?.(data, variables, onMutateResult, context);
      },
    });

    return {
      scanClearMutation,
    };
  },

  useSaveSegments: (
    options?: Omit<UseMutationOptions<unknown, Error, PayloadOnly<SegmentsSaveRequestDto>>, 'mutationKey' | 'mutationFn'>,
  ) => {
    const segmentsSaveMutation = useMutation<unknown, Error, PayloadOnly<SegmentsSaveRequestDto>>({
      mutationKey: ApiMutationKeys.Scans.saveSegments(),
      mutationFn: (payload) => ScansApi.saveSegments(payload),
      ...options,
      onSuccess: (data, variables, onMutateResult, context) => {
        refreshMediaOverview();
        options?.onSuccess?.(data, variables, onMutateResult, context);
      },
    });

    return {
      segmentsSaveMutation,
    };
  },
};
