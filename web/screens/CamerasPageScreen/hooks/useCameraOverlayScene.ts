import {
  useMemo
} from 'react';

import {
  manualReadsOf
} from '@basekm/@shared/utils/manualReads';
import {
  scannedRunnersOf,
  toDetections
} from '@basekm/@shared/utils/scannedRunners';
import {
  MediaQueries,
  TagsQueries
} from '@basekm/api';
import {
  MediaScanFilesDto
} from '@basekm/dtos';
import {
  OverlayScene
} from '@basekm/screens/ViewerPageScreen/utils/drawVideoOverlay';

type CameraOverlaySceneParams = {
  scanFiles: MediaScanFilesDto | null;
  clockOffset: number | null;
};

export const useCameraOverlayScene = ({
  scanFiles,
  clockOffset,
}: CameraOverlaySceneParams): OverlayScene | null => {
  const detectionsUrl = scanFiles?.detections || scanFiles?.segments || '';
  const savedSegmentsUrl = (scanFiles?.detections && scanFiles?.segments) || '';
  const tagsUrl = scanFiles?.tags || '';

  const {
    detectionsGetQuery
  } = MediaQueries.useGetDetections({
    url: detectionsUrl,
  });
  const {
    segmentsGetQuery
  } = MediaQueries.useGetSegments({
    url: savedSegmentsUrl,
  });
  const {
    tagsGetQuery
  } = TagsQueries.useGetByUrl({
    url: tagsUrl,
  });

  const detectionsJson = detectionsGetQuery.data;
  const savedSegments = segmentsGetQuery.data?.segments;
  const tags = tagsGetQuery.data;

  return useMemo(() => {
    if (!detectionsJson) {
      return null;
    }

    const detections = toDetections(detectionsJson);
    const segments = (savedSegments?.length && savedSegments) || detections.segments || [];
    const scannedRunners = scannedRunnersOf({
      detections,
      segments,
      manualReads: manualReadsOf(tags ?? {}),
    });

    return {
      frames: scannedRunners.frames,
      segments,
      sightings: scannedRunners.sightings,
      crossedBibs: scannedRunners.crossedBibs,
      targets: scannedRunners.targets,
      isPeopleShown: true,
      isBibsShown: true,
      isEveryBibShown: true,
      finishLinePoints: null,
      clockOffset,
      swipeFlashUntil: 0,
    };
  }, [clockOffset, detectionsJson, savedSegments, tags]);
};
