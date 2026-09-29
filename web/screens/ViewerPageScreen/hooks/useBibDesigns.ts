import {
  useCallback,
  useMemo,
  useState
} from 'react';

import {
  toast
} from '@/components/ui/toast';

import {
  TemplatesInUseStorageKey
} from '@basekm/@shared/constants';
import {
  TemplatesMutations,
  TemplatesQueries
} from '@basekm/api';
import {
  useLocalStorageState
} from '@basekm/hooks/use-local-storage-state';


import {
  FramePoint
} from './useViewerSession';

export const BibDesignPickMode = {
  Calibrate: 'calibrate',
  New: 'new',
} as const;
export type BibDesignPickMode = (typeof BibDesignPickMode)[keyof typeof BibDesignPickMode];

export type BibDesignPicking = {
  mode: BibDesignPickMode;
  templateId?: string;
  name?: string;
};

export type PendingBibDesign = {
  image?: string;
  at?: number[];
};

export type BibDesignDetails = {
  name: string;
  minBib: number;
  maxBib: number;
};

const NoTemplatesInUse: string[] = [];

const lastLineOf = (text: string) => text.split('\n').filter(Boolean).pop() ?? text;

const describeError = (error: unknown) => lastLineOf(error instanceof Error ? error.message : String(error));

const readImageAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(file);
});

type UseBibDesignsParams = {
  isServerAvailable: boolean;
  mediaVideo: string | null;
  pausedAt: number | null;
  isFinderShown: boolean;
};

export const useBibDesigns = ({
  isServerAvailable,
  mediaVideo,
  pausedAt,
  isFinderShown,
}: UseBibDesignsParams) => {
  const {
    templatesGetAllQuery
  } = TemplatesQueries.useGetAll({
    enabled: isServerAvailable,
  });
  const templates = useMemo(() => templatesGetAllQuery.data ?? [], [templatesGetAllQuery.data]);

  const [storedTemplateIds, setStoredTemplateIds] = useLocalStorageState<string[]>({
    key: TemplatesInUseStorageKey,
    defaultValue: NoTemplatesInUse,
  });
  const templateIdsInUse = useMemo(
    () => storedTemplateIds.filter((templateId) => templates.some((template) => template.id === templateId)),
    [storedTemplateIds, templates],
  );

  const [picking, setPicking] = useState<BibDesignPicking | null>(null);
  const [pendingDesign, setPendingDesign] = useState<PendingBibDesign | null>(null);

  const {
    templateCreateMutation
  } = TemplatesMutations.useCreate();
  const {
    templateCalibrateMutation
  } = TemplatesMutations.useCalibrate();
  const {
    templateRemoveMutation
  } = TemplatesMutations.useRemove();

  const finderTime = pausedAt === null ? 0 : Number(pausedAt.toFixed(3));
  const isFinderEnabled = isFinderShown && pausedAt !== null && Boolean(mediaVideo) && templateIdsInUse.length > 0;
  const {
    templateFinderQuery
  } = TemplatesQueries.useFind({
    video: mediaVideo ?? '',
    t: finderTime,
    templates: templateIdsInUse,
  }, {
    enabled: isFinderEnabled,
  });
  const finder = isFinderEnabled && templateFinderQuery.data ? {
    ...templateFinderQuery.data,
    t: finderTime,
  } : null;

  const setTemplateInUse = useCallback(({
    templateId,
    isInUse,
  }: {
    templateId: string;
    isInUse: boolean;
  }) => {
    const others = storedTemplateIds.filter((storedId) => storedId !== templateId);
    setStoredTemplateIds(isInUse ? [...others, templateId] : others);
  }, [setStoredTemplateIds, storedTemplateIds]);

  const startPicking = useCallback((next: BibDesignPicking) => {
    if (!mediaVideo) {
      toast.add({
        title: 'Open the video from the list at the top first',
        type: 'info',
      });
      return;
    }

    const isSamePick = picking?.mode === next.mode && picking?.templateId === next.templateId;
    setPicking(isSamePick ? null : next);
  }, [mediaVideo, picking]);

  const stopPicking = useCallback(() => {
    setPicking(null);
  }, []);

  const addFromImage = useCallback(async (file: File) => {
    setPendingDesign({
      image: await readImageAsDataUrl(file),
    });
  }, []);

  const createPendingDesign = useCallback(async (details: BibDesignDetails) => {
    const pending = pendingDesign;
    setPendingDesign(null);

    if (!pending) {
      return;
    }

    try {
      const created = await templateCreateMutation.mutateAsync({
        ...details,
        image: pending.image,
        video: pending.at ? mediaVideo ?? undefined : undefined,
        at: pending.at,
      });
      setStoredTemplateIds([...storedTemplateIds.filter((storedId) => storedId !== created.id), created.id]);
      toast.add({
        title: `Bib design "${details.name}" added`,
        description: 'Calibrate it on 3–5 clear bibs in the video to make it sturdier.',
        type: 'success',
      });
    } catch (error) {
      toast.add({
        title: 'Could not add the bib design',
        description: describeError(error),
        type: 'error',
      });
    }
  }, [mediaVideo, pendingDesign, setStoredTemplateIds, storedTemplateIds, templateCreateMutation]);

  const cancelPendingDesign = useCallback(() => {
    setPendingDesign(null);
  }, []);

  const pickAt = useCallback(async ({
    point,
    time,
  }: {
    point: FramePoint;
    time: number;
  }) => {
    if (!picking || !mediaVideo) {
      return;
    }

    const at = [Number(time.toFixed(3)), point.x, point.y];

    if (picking.mode === BibDesignPickMode.New) {
      setPicking(null);
      setPendingDesign({
        at,
      });
      return;
    }

    try {
      const calibrated = await templateCalibrateMutation.mutateAsync({
        template: picking.templateId ?? '',
        video: mediaVideo,
        at,
      });
      toast.add({
        title: `${picking.name}: ${lastLineOf(calibrated.message)}`,
        description: 'Click another bib, or press Esc when done.',
        type: 'success',
      });
    } catch (error) {
      toast.add({
        title: 'Could not measure that bib',
        description: describeError(error),
        type: 'error',
      });
    }
  }, [mediaVideo, picking, templateCalibrateMutation]);

  const removeTemplate = useCallback(async (templateId: string) => {
    try {
      await templateRemoveMutation.mutateAsync({
        template: templateId,
      });
      setTemplateInUse({
        templateId,
        isInUse: false,
      });
    } catch (error) {
      toast.add({
        title: 'Could not remove the bib design',
        description: describeError(error),
        type: 'error',
      });
    }
  }, [setTemplateInUse, templateRemoveMutation]);

  return {
    templates,
    templateIdsInUse,
    setTemplateInUse,
    picking,
    startPicking,
    stopPicking,
    pickAt,
    pendingDesign,
    addFromImage,
    createPendingDesign,
    cancelPendingDesign,
    removeTemplate,
    finder,
  };
};
