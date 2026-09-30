import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react';

import {
  toast
} from '@/components/ui/toast';


import {
  isScanRunning,
  ScanPhaseLabels,
  ScanStateId,
  SelectedVideoStorageKey,
  SightingLabel
} from '@basekm/@shared/constants';
import {
  splitCameraSegment,
  CameraSegmentKind,
  setFinishLine
} from '@basekm/@shared/utils/cameraSegments';
import {
  decideSightings,
  sortSightingsByTime
} from '@basekm/@shared/utils/decideSightings';
import {
  downloadFile,
  videoStem
} from '@basekm/@shared/utils/downloadFile';
import {
  formatClockTime,
  formatVideoTime,
  parseClockTime
} from '@basekm/@shared/utils/formatTime';
import {
  segmentAt
} from '@basekm/@shared/utils/frameGeometry';
import {
  addManualRead,
  findSightingOfRead,
  manualReadsOf,
  markManualSightings,
  removeManualSighting,
  withManualReads
} from '@basekm/@shared/utils/manualReads';
import {
  currentSightingLabel,
  sightingKey,
  toggleSightingTag
} from '@basekm/@shared/utils/sightingTags';
import {
  ApiQueryKeys,
  MediaApi,
  MediaMutations,
  MediaQueries,
  ScansMutations,
  ScansQueries,
  SightingsMutations,
  TagsApi,
  TagsMutations
} from '@basekm/api';
import {
  CameraSegmentDto,
  DetectionsDto,
  ManualReadDto,
  SegmentsFileDto,
  SightingDto,
  SightingSearchResultDto,
  TagsBySightingKey
} from '@basekm/dtos';
import {
  getQueryClient
} from '@basekm/lib/queryClient';

import {
  VideoPlaybackController
} from '../utils/VideoPlaybackController';

import {
  useAutosave
} from './useAutosave';

export type VideoSource = {
  src: string;
  name: string;
  mediaVideo: string | null;
};

export type FramePoint = {
  x: number;
  y: number;
};

const LegacyClockStorageKey = (videoName: string) => `bibwatch.clock.${videoName}`;

const toDetections = (json: DetectionsDto | SegmentsFileDto): DetectionsDto => {
  if ('frames' in json && Array.isArray(json.frames)) {
    return {
      ...json,
      frames: [...json.frames].sort((a, b) => a.t - b.t),
    };
  }

  return {
    video: json.video,
    duration: json.duration,
    segments: json.segments ?? [],
    frames: [],
    sightings: [],
    clock: null,
  };
};

const readLegacyClock = (videoName: string) => {
  try {
    const stored = window.localStorage.getItem(LegacyClockStorageKey(videoName));
    return stored === null ? null : Number(stored);
  } catch {
    return null;
  }
};

const writeLegacyClock = ({
  videoName,
  clockOffset,
}: {
  videoName: string;
  clockOffset: number;
}) => {
  try {
    window.localStorage.setItem(LegacyClockStorageKey(videoName), String(clockOffset));
  } catch {
    return;
  }
};

const readSelectedVideo = () => {
  try {
    return window.localStorage.getItem(SelectedVideoStorageKey);
  } catch {
    return null;
  }
};

const writeSelectedVideo = (videoName: string | null) => {
  try {
    if (videoName === null) {
      window.localStorage.removeItem(SelectedVideoStorageKey);
      return;
    }

    window.localStorage.setItem(SelectedVideoStorageKey, videoName);
  } catch {
    return;
  }
};

const describeError = (error: unknown) => (error instanceof Error ? error.message : String(error));

const formatEta = (seconds: number | null | undefined) => {
  if (seconds === null || seconds === undefined) {
    return '';
  }

  const minutes = Math.round(seconds / 60);
  const text = seconds >= 90 ? `${minutes} min` : `${Math.round(seconds)} s`;
  return ` · ~${text} left`;
};

type UseViewerSessionParams = {
  controller: VideoPlaybackController;
};

export const useViewerSession = ({
  controller,
}: UseViewerSessionParams) => {
  const {
    mediaOverviewGetQuery
  } = MediaQueries.useGetOverview();
  const mediaOverview = mediaOverviewGetQuery.data ?? null;
  const isServerAvailable = mediaOverview !== null;

  const [videoSource, setVideoSource] = useState<VideoSource | null>(null);
  const [detections, setDetections] = useState<DetectionsDto | null>(null);
  const [segments, setSegments] = useState<CameraSegmentDto[]>([]);
  const [clockOffset, setClockOffset] = useState<number | null>(null);
  const [tags, setTags] = useState<TagsBySightingKey>({});
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [isPeopleFirst, setIsPeopleFirst] = useState(false);
  const [finishLinePoints, setFinishLinePoints] = useState<FramePoint[] | null>(null);
  const [pendingRead, setPendingRead] = useState<ManualReadDto | null>(null);

  const segmentsRef = useRef<CameraSegmentDto[]>([]);
  const mediaVideo = videoSource?.mediaVideo ?? null;
  const mediaVideoRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    segmentsRef.current = segments;
    mediaVideoRef.current = mediaVideo;
  }, [segments, mediaVideo]);

  const {
    autosaveStatus,
    autosaveErrorMessage,
    scheduleSave,
  } = useAutosave();

  const {
    videoClockSaveMutation
  } = MediaMutations.useSaveClock();
  const {
    segmentsSaveMutation
  } = ScansMutations.useSaveSegments();
  const {
    sightingsSaveMutation
  } = SightingsMutations.useSave();
  const {
    tagsSaveMutation
  } = TagsMutations.useSave();
  const {
    scanStartMutation
  } = ScansMutations.useStart();
  const {
    scanCancelMutation
  } = ScansMutations.useCancel();
  const {
    scanClearMutation
  } = ScansMutations.useClear();

  const saveVideoClock = videoClockSaveMutation.mutateAsync;
  const moveLegacyClock = videoClockSaveMutation.mutate;
  const saveSegmentsFile = segmentsSaveMutation.mutateAsync;
  const saveSightings = sightingsSaveMutation.mutateAsync;
  const saveTags = tagsSaveMutation.mutateAsync;
  const startScanJob = scanStartMutation.mutateAsync;
  const cancelScanJob = scanCancelMutation.mutate;
  const clearScanFiles = scanClearMutation.mutateAsync;

  const manualReads = useMemo(() => manualReadsOf(tags), [tags]);

  const scanWithManualReads = useMemo(() => withManualReads({
    frames: detections?.frames ?? [],
    coarseHits: detections?.coarseHits,
    manualReads,
  }), [detections, manualReads]);

  const frames = scanWithManualReads.frames;

  const targets = useMemo(() => {
    if (detections?.targets) {
      return new Set(detections.targets);
    }

    return new Set((detections?.sightings ?? []).filter((sighting) => sighting.target).map((sighting) => sighting.bib));
  }, [detections]);

  const sightings = useMemo(() => {
    if (!detections) {
      return [];
    }

    if (detections.coarseHits && scanWithManualReads.coarseHits) {
      const decided = decideSightings({
        coarseHits: scanWithManualReads.coarseHits,
        segments,
        frames,
        targets,
        settings: detections.settings,
      });
      return markManualSightings({
        sightings: decided,
        manualReads,
      });
    }

    return sortSightingsByTime(detections.sightings ?? []);
  }, [detections, segments, frames, targets, scanWithManualReads, manualReads]);

  if (pendingRead) {
    const added = findSightingOfRead({
      sightings,
      read: pendingRead,
    });
    if (added) {
      setSelectedKey(sightingKey(added));
    }
    setPendingRead(null);
  }

  const crossedBibs = useMemo(() => {
    const crossed = sightings.filter((sighting) => currentSightingLabel(sighting) === SightingLabel.Crossed);
    return new Set(crossed.map((sighting) => sighting.bib));
  }, [sightings]);

  const needsScanCount = useMemo(() => sightings.filter((sighting) => sighting.label === SightingLabel.NeedsScan).length, [sightings]);

  const duration = detections?.duration || 0;

  useEffect(() => {
    controller.setFallbackDuration(detections?.duration ?? 0);
  }, [controller, detections]);

  const segmentsFile = useCallback((nextSegments: CameraSegmentDto[]): SegmentsFileDto => ({
    video: detections?.video || videoSource?.name || null,
    duration: detections?.duration || controller.duration || null,
    segments: nextSegments,
  }), [controller, detections, videoSource]);

  const saveSegments = useCallback((nextSegments: CameraSegmentDto[]) => {
    const video = mediaVideoRef.current;
    if (!isServerAvailable || !video || !nextSegments.length) {
      return;
    }

    const payload = segmentsFile(nextSegments);
    scheduleSave({
      key: 'segments',
      delayMs: 400,
      task: () => saveSegmentsFile({
        video,
        segments: payload,
      }),
      failureMessage: 'Could not save your finish lines — use Download a copy as a backup',
    });
  }, [isServerAvailable, scheduleSave, segmentsFile, saveSegmentsFile]);

  const updateSegments = useCallback((nextSegments: CameraSegmentDto[]) => {
    setSegments(nextSegments);
    saveSegments(nextSegments);
  }, [saveSegments]);

  useEffect(() => {
    if (!isServerAvailable || !mediaVideo || !detections?.coarseHits) {
      return;
    }

    const video = mediaVideo;
    const payload = sightings.map((sighting) => ({
      bib: sighting.bib,
      from: sighting.from,
      to: sighting.to,
      cross: sighting.cross ?? null,
      label: sighting.label,
      zone: sighting.zone ?? null,
      direction: sighting.direction ?? null,
      template: sighting.template ?? null,
      target: Boolean(sighting.target),
      registered: typeof sighting.registered === 'boolean' ? sighting.registered : null,
      reads: sighting.reads ?? 0,
      note: sighting.note || '',
    }));
    const videoDuration = detections.duration || controller.duration || null;

    scheduleSave({
      key: 'sightings',
      delayMs: 800,
      task: () => saveSightings({
        video,
        duration: videoDuration,
        sightings: payload,
      }),
      failureMessage: 'Could not save runners for search',
    });
  }, [sightings, isServerAvailable, mediaVideo, detections, controller, scheduleSave, saveSightings]);

  const loadDetections = useCallback((json: DetectionsDto | SegmentsFileDto) => {
    const loaded = toDetections(json);
    setDetections(loaded);
    setSegments(loaded.segments ?? []);

    if (loaded.clock) {
      const clockFromScan = parseClockTime(loaded.clock);
      setClockOffset((current) => current ?? clockFromScan);
    }

    if (loaded.settings) {
      setIsPeopleFirst(loaded.settings.reader === 'people-first');
    }

    return loaded;
  }, []);

  const applyScanResults = useCallback((json: DetectionsDto) => {
    const keptSegments = segmentsRef.current;
    const loaded = toDetections(json);
    setDetections(loaded);

    if (!keptSegments.length) {
      setSegments(loaded.segments ?? []);
    }
  }, []);

  const loadVideo = useCallback((source: VideoSource) => {
    const serverClock = source.mediaVideo ? mediaOverview?.clocks?.[source.mediaVideo] : undefined;
    const legacyClock = readLegacyClock(source.name);

    setVideoSource(source);
    writeSelectedVideo(source.mediaVideo);
    setClockOffset(serverClock ?? legacyClock ?? null);
    setFinishLinePoints(null);

    const shouldMoveLegacyClock = serverClock === undefined && legacyClock !== null && source.mediaVideo !== null;
    if (shouldMoveLegacyClock && source.mediaVideo) {
      moveLegacyClock({
        video: source.mediaVideo,
        clockOffset: legacyClock,
      });
    }
  }, [mediaOverview, moveLegacyClock]);

  const loadTags = useCallback(async (url: string | null | undefined) => {
    setTags({});
    setSelectedKey(null);

    if (!url) {
      return;
    }

    try {
      setTags(await TagsApi.getByUrl({
        url,
      }));
    } catch {
      setTags({});
    }
  }, []);

  const openLibraryVideo = useCallback(async (name: string) => {
    if (!name) {
      return;
    }

    loadVideo({
      src: `/media/${encodeURIComponent(name)}`,
      name,
      mediaVideo: name,
    });

    const scanFiles = mediaOverview?.scans?.[videoStem(name)];
    const dataUrl = scanFiles?.detections || scanFiles?.segments;

    if (!dataUrl) {
      setDetections(null);
      setSegments([]);
      await loadTags(scanFiles?.tags);
      return;
    }

    try {
      loadDetections(await MediaApi.getDetections({
        url: dataUrl,
      }));

      if (scanFiles?.detections && scanFiles?.segments) {
        const saved = await MediaApi.getSegments({
          url: scanFiles.segments,
        }).catch(() => null);

        if (saved?.segments?.length) {
          setSegments(saved.segments);
        }
      }
    } catch (error) {
      toast.add({
        title: `Could not open the scan of ${name}`,
        description: describeError(error),
        type: 'error',
      });
    }

    await loadTags(scanFiles?.tags);
  }, [loadDetections, loadTags, loadVideo, mediaOverview]);

  const openFile = useCallback((file: File) => {
    const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|m4v)$/i.test(file.name);
    if (!isVideo) {
      return;
    }

    loadVideo({
      src: URL.createObjectURL(file),
      name: file.name,
      mediaVideo: null,
    });
  }, [loadVideo]);

  const openFromQuery = useCallback(async () => {
    const query = new URLSearchParams(window.location.search);
    const videoUrl = query.get('video');
    const dataUrl = query.get('data');

    if (videoUrl) {
      const isMediaVideo = videoUrl.startsWith('/media/');
      loadVideo({
        src: videoUrl,
        name: decodeURIComponent(videoUrl.split('/').pop() ?? videoUrl),
        mediaVideo: isMediaVideo ? decodeURIComponent(videoUrl.slice('/media/'.length)) : null,
      });
    }

    if (dataUrl) {
      try {
        loadDetections(await MediaApi.getDetections({
          url: dataUrl,
        }));
      } catch (error) {
        toast.add({
          title: 'Could not load the results',
          description: describeError(error),
          type: 'error',
        });
      }
    }
  }, [loadDetections, loadVideo]);

  const restoreSelectedVideo = useCallback(async () => {
    const hasQueryVideo = new URLSearchParams(window.location.search).has('video');
    const storedVideo = readSelectedVideo();
    if (hasQueryVideo || videoSource || !storedVideo || !mediaOverview?.videos.includes(storedVideo)) {
      return;
    }

    await openLibraryVideo(storedVideo);
  }, [mediaOverview, openLibraryVideo, videoSource]);

  const saveClock = useCallback((nextClockOffset: number) => {
    setClockOffset(nextClockOffset);

    if (videoSource) {
      writeLegacyClock({
        videoName: videoSource.name,
        clockOffset: nextClockOffset,
      });
    }

    const video = mediaVideoRef.current;
    if (!isServerAvailable || !video) {
      return;
    }

    scheduleSave({
      key: 'clock',
      delayMs: 0,
      task: () => saveVideoClock({
        video,
        clockOffset: nextClockOffset,
      }),
      failureMessage: 'Could not save the race clock',
    });
  }, [isServerAvailable, scheduleSave, saveVideoClock, videoSource]);

  const splitSegmentHere = useCallback(() => {
    controller.pause();
    const edit = splitCameraSegment({
      segments: segmentsRef.current,
      time: controller.currentTime,
    });

    if (!edit) {
      toast.add({
        title: 'Nothing to split yet',
        description: 'Open a scanned video (or its segments.json) first.',
        type: 'info',
      });
      return;
    }

    updateSegments(edit.segments);
    toast.add({
      title: `Camera position ${edit.focus.index} starts at ${formatVideoTime(edit.focus.from, true)}`,
      description: 'Mark its finish line if the camera moved.',
      type: 'success',
    });
  }, [controller, updateSegments]);

  const toggleFinishLineMarking = useCallback(() => {
    if (!segmentsRef.current.length) {
      toast.add({
        title: 'No camera positions yet',
        description: 'Scan the video (or open its segments.json) before marking a finish line.',
        type: 'info',
      });
      return;
    }

    controller.pause();

    if (finishLinePoints) {
      setFinishLinePoints(null);
      return;
    }

    const segment = segmentAt({
      segments: segmentsRef.current,
      time: controller.currentTime,
    });
    const isMovingCamera = segment !== null && segment.kind !== CameraSegmentKind.Fixed;

    if (isMovingCamera) {
      const edit = splitCameraSegment({
        segments: segmentsRef.current,
        time: controller.currentTime,
        kindAfter: CameraSegmentKind.Fixed,
      });
      if (edit) {
        updateSegments(edit.segments);
      }
    }

    setFinishLinePoints([]);
  }, [controller, finishLinePoints, updateSegments]);

  const addFinishLinePoint = useCallback((point: FramePoint) => {
    if (!finishLinePoints) {
      return;
    }

    const points = [...finishLinePoints, point];
    if (points.length < 2) {
      setFinishLinePoints(points);
      return;
    }

    const [left, right] = points[0].x <= points[1].x ? points : [points[1], points[0]];
    const segment = segmentAt({
      segments: segmentsRef.current,
      time: controller.currentTime,
    });
    setFinishLinePoints(null);

    if (!segment) {
      return;
    }

    updateSegments(setFinishLine({
      segments: segmentsRef.current,
      segmentIndex: segment.index,
      finishLine: {
        x0: left.x,
        y0: left.y,
        x1: right.x,
        y1: right.y,
      },
    }));
    toast.add({
      title: `Finish line set for camera position ${segment.index}`,
      description: 'Runners are re-checked against it right away.',
      type: 'success',
    });
  }, [controller, finishLinePoints, updateSegments]);

  const cancelFinishLineMarking = useCallback(() => {
    setFinishLinePoints(null);
  }, []);

  const updateTags = useCallback((nextTags: TagsBySightingKey) => {
    setTags(nextTags);

    const video = mediaVideoRef.current;
    if (!isServerAvailable || !video) {
      toast.add({
        title: 'Tags are kept for this session only',
        description: 'Open the video from the list at the top to save them.',
        type: 'info',
      });
      return;
    }

    scheduleSave({
      key: 'tags',
      delayMs: 400,
      task: () => saveTags({
        video,
        tags: nextTags,
      }),
      failureMessage: 'Could not save tags',
    });
  }, [isServerAvailable, scheduleSave, saveTags]);

  const toggleTag = useCallback((tag: string) => {
    if (!selectedKey || !tag) {
      return;
    }

    updateTags(toggleSightingTag({
      tags,
      key: selectedKey,
      tag,
    }));
  }, [selectedKey, tags, updateTags]);

  const canAddRunners = Boolean(detections?.coarseHits);

  const addRunner = useCallback((read: ManualReadDto) => {
    if (!canAddRunners) {
      toast.add({
        title: 'Scan this video again to add runners by hand',
        description: 'This scan was made by an older version that keeps only the final runner list.',
        type: 'info',
      });
      return;
    }

    updateTags(addManualRead({
      tags,
      read,
    }));
    setPendingRead(read);
  }, [canAddRunners, tags, updateTags]);

  const removeRunner = useCallback((sighting: SightingDto) => {
    updateTags(removeManualSighting({
      tags,
      sighting,
    }));
    setSelectedKey(null);
  }, [tags, updateTags]);

  const exportSegments = useCallback(() => {
    if (!segments.length) {
      toast.add({
        title: 'Nothing to download yet',
        type: 'info',
      });
      return;
    }

    const file = segmentsFile(segments);
    downloadFile({
      content: JSON.stringify(file, null, 2),
      fileName: `segments_${videoStem(file.video || 'video')}.json`,
      type: 'application/json',
    });
  }, [segments, segmentsFile]);

  const {
    scanStatusGetQuery
  } = ScansQueries.useGetStatus({
    enabled: isServerAvailable,
    refetchInterval: (query) => (isScanRunning(query.state.data?.state) ? 1000 : false),
  });
  const scanStatus = scanStatusGetQuery.data ?? null;
  const isScanning = isScanRunning(scanStatus?.state);
  const isScanningThisVideo = isScanning && scanStatus?.video === mediaVideo;
  const lastCheckpointRef = useRef<number | null>(null);
  const wasScanningRef = useRef(false);

  useEffect(() => {
    if (!scanStatus) {
      return;
    }

    const wasScanning = wasScanningRef.current;
    wasScanningRef.current = isScanning;
    const justFinished = wasScanning && !isScanning;
    const isThisVideo = scanStatus.video === mediaVideoRef.current;
    const hasNewCheckpoint = Boolean(scanStatus.partial && scanStatus.checkpoint && scanStatus.checkpoint !== lastCheckpointRef.current);

    if (isThisVideo && hasNewCheckpoint && (isScanning || justFinished) && scanStatus.partial) {
      lastCheckpointRef.current = scanStatus.checkpoint ?? null;
      MediaApi.getDetections({
        url: scanStatus.partial,
      })
        .then((json) => applyScanResults(json as DetectionsDto))
        .catch(() => undefined);
    }

    if (!justFinished) {
      return;
    }

    getQueryClient().invalidateQueries({
      queryKey: ApiQueryKeys.Media.getOverview(),
    });

    if (scanStatus.state === ScanStateId.Done) {
      toast.add({
        title: `Scan finished in ${Math.max(1, Math.round((scanStatus.elapsed ?? 0) / 60))} min`,
        description: scanStatus.video,
        type: 'success',
      });
      return;
    }

    if (scanStatus.state === ScanStateId.Cancelled) {
      toast.add({
        title: 'Scan stopped',
        description: 'Everything read so far is kept. Scanning again continues from there.',
        type: 'info',
      });
      return;
    }

    toast.add({
      title: 'Scan failed',
      description: scanStatus.message || 'unknown error',
      type: 'error',
    });
  }, [scanStatus, isScanning, applyScanResults]);

  const readingAt = isScanningThisVideo && scanStatus?.phase === 'scan' ? scanStatus.at ?? null : null;

  const scanStatusText = useMemo(() => {
    if (!isServerAvailable) {
      return null;
    }

    if (isScanning && scanStatus) {
      const fraction = scanStatus.total ? (scanStatus.done ?? 0) / scanStatus.total : 0;
      const percent = scanStatus.total ? ` ${Math.round(fraction * 100)}%` : '';
      const phase = ScanPhaseLabels[scanStatus.phase ?? ''] ?? 'Starting…';
      const otherVideo = scanStatus.video !== mediaVideo ? ` ${scanStatus.video}:` : '';
      return `${otherVideo} ${phase}${percent}${formatEta(scanStatus.eta)}`.trim();
    }

    if (!mediaVideo) {
      return null;
    }

    if (!detections?.coarseHits && !detections?.sightings?.length) {
      return 'Not scanned yet';
    }

    if (scanStatus?.state === ScanStateId.Failed && scanStatus.video === mediaVideo) {
      return 'Last scan failed';
    }

    return 'Scan finished';
  }, [detections, isScanning, isServerAvailable, mediaVideo, scanStatus]);

  const scanProgress = isScanning && scanStatus?.total ? (scanStatus.done ?? 0) / scanStatus.total : null;

  const scanButtonLabel = useMemo(() => {
    if (isScanning) {
      return 'Stop scan';
    }

    if (detections?.scanning) {
      return 'Continue scan';
    }

    if (detections?.coarseHits) {
      return 'Scan again';
    }

    return 'Run scan';
  }, [detections, isScanning]);

  const canScan = isScanning || (isServerAvailable && Boolean(mediaVideo));

  const startScan = useCallback(async (templateIds: string[]) => {
    if (isScanning) {
      cancelScanJob();
      return;
    }

    if (!mediaVideo) {
      return;
    }

    try {
      await startScanJob({
        video: mediaVideo,
        segments: segments.length ? segmentsFile(segments) : null,
        clock: clockOffset !== null ? formatClockTime(clockOffset) : null,
        templates: templateIds,
        from: Number(controller.currentTime.toFixed(1)),
        // Bib designs choose where to read; "Only look for people" applies without them.
        peopleFirst: isPeopleFirst && templateIds.length === 0,
      });
      lastCheckpointRef.current = null;
    } catch (error) {
      toast.add({
        title: 'Could not start the scan',
        description: describeError(error),
        type: 'error',
      });
    }
  }, [clockOffset, controller, isPeopleFirst, isScanning, mediaVideo, cancelScanJob, startScanJob, segments, segmentsFile]);

  const scanMadeWithPeopleFirst = detections?.settings ? detections.settings.reader === 'people-first' : null;

  const clearScans = useCallback(async (keepSegments: boolean) => {
    if (!mediaVideo) {
      return;
    }

    try {
      const result = await clearScanFiles({
        video: mediaVideo,
        keepSegments,
      });
      const keptSegments = keepSegments ? segments : [];

      setDetections(keptSegments.length ? {
        video: videoSource?.name ?? null,
        duration: controller.duration,
        segments: keptSegments,
        frames: [],
        sightings: [],
        clock: null,
      } : null);
      setSegments(keptSegments);

      const removed = result.removed.length ? result.removed.join(', ') : 'nothing (no saved scan)';
      const keptNote = keepSegments ? ' · finish lines and camera splits kept' : '';
      toast.add({
        title: 'Scans cleared',
        description: `Removed ${removed}${keptNote}`,
        type: 'success',
      });
    } catch (error) {
      toast.add({
        title: 'Could not clear',
        description: describeError(error),
        type: 'error',
      });
    }
  }, [controller, mediaVideo, clearScanFiles, segments, videoSource]);

  const openSearchResult = useCallback(async (result: SightingSearchResultDto) => {
    if (result.video !== mediaVideoRef.current) {
      await openLibraryVideo(result.video);
    }

    const seek = () => {
      controller.pause();
      controller.seekTo(Math.max(0, result.at - 1));
      setSelectedKey(result.key);
    };

    const video = controller.video;
    if (!video || video.readyState >= 1) {
      seek();
      return;
    }

    video.addEventListener('loadedmetadata', seek, {
      once: true,
    });
  }, [controller, openLibraryVideo]);

  return {
    mediaOverview,
    isServerAvailable,
    videoSource,
    mediaVideo,
    detections,
    frames,
    segments,
    sightings,
    targets,
    crossedBibs,
    needsScanCount,
    duration,
    clockOffset,
    tags,
    selectedKey,
    setSelectedKey,
    isPeopleFirst,
    setIsPeopleFirst,
    finishLinePoints,
    autosaveStatus,
    autosaveErrorMessage,
    scanStatus,
    scanStatusText,
    scanProgress,
    scanButtonLabel,
    canScan,
    isScanning,
    readingAt,
    scanMadeWithPeopleFirst,
    openLibraryVideo,
    openFile,
    openFromQuery,
    restoreSelectedVideo,
    saveClock,
    splitSegmentHere,
    toggleFinishLineMarking,
    addFinishLinePoint,
    cancelFinishLineMarking,
    toggleTag,
    canAddRunners,
    addRunner,
    removeRunner,
    exportSegments,
    startScan,
    clearScans,
    openSearchResult,
  };
};
