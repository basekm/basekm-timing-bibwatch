'use client';

import {
  ChangeEvent,
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
  cn
} from '@/lib/utils';


import {
  AnyDirectionValue,
  RunnerListFilter,
  RunnerListScope,
  SwipeReverseStorageKey,
  SwipeSpeedDefault,
  SwipeSpeedStorageKey
} from '@basekm/@shared/constants';
import {
  buildSightingsCsv
} from '@basekm/@shared/utils/buildSightingsCsv';
import {
  sightingTime
} from '@basekm/@shared/utils/decideSightings';
import {
  downloadFile,
  videoStem
} from '@basekm/@shared/utils/downloadFile';
import {
  isPointInBox,
  nearestFrame,
  segmentAt
} from '@basekm/@shared/utils/frameGeometry';
import {
  sightingKey
} from '@basekm/@shared/utils/sightingTags';
import {
  EventMutations,
  EventQueries
} from '@basekm/api';
import {
  ViewerHeader,
  ViewerHeaderVideo
} from '@basekm/components/ViewerHeader';
import {
  EventSettingsSaveRequestDto,
  SightingDto,
  TemplateGetResponseDto
} from '@basekm/dtos';
import {
  useLocalStorageState
} from '@basekm/hooks/use-local-storage-state';
import {
  useVideoElementState
} from '@basekm/hooks/use-video-element-state';

import {
  BibDesignDetailsDialog
} from './components/BibDesignDetailsDialog';
import {
  BibDesignsDialog
} from './components/BibDesignsDialog';
import {
  BibNumbersDialog
} from './components/BibNumbersDialog';
import {
  ClearScansDialog
} from './components/ClearScansDialog';
import {
  ConfirmDialog,
  ConfirmRequest
} from './components/ConfirmDialog';
import {
  EmptyViewerState
} from './components/EmptyViewerState';
import {
  MarkAndAnnotateBar
} from './components/MarkAndAnnotateBar';
import {
  RaceClockDialog
} from './components/RaceClockDialog';
import {
  RaceTimelineCard
} from './components/RaceTimelineCard';
import {
  RunnersSpottedPanel
} from './components/RunnersSpottedPanel';
import {
  VideoPlayerCard
} from './components/VideoPlayerCard';
import {
  OverlaySettings,
  ViewerMoreMenu
} from './components/ViewerMoreMenu';
import {
  BibDesignPickMode,
  useBibDesigns
} from './hooks/useBibDesigns';
import {
  useVideoTime
} from './hooks/useVideoTime';
import {
  FramePoint,
  useViewerSession
} from './hooks/useViewerSession';
import {
  useViewerShortcuts
} from './hooks/useViewerShortcuts';
import {
  OverlayScene
} from './utils/drawVideoOverlay';
import {
  filterRunners,
  RunnerListFilters
} from './utils/runnerListFilters';
import {
  unscannedRangesOf
} from './utils/unscannedRanges';
import {
  VideoPlaybackController
} from './utils/VideoPlaybackController';

const DefaultRunnerListFilters: RunnerListFilters = {
  filter: RunnerListFilter.All,
  search: '',
  direction: AnyDirectionValue,
};

const DefaultOverlaySettings: OverlaySettings = {
  isPeopleShown: true,
  isBibsShown: true,
  isEveryBibShown: true,
};

const DefaultMaxBib = 250;
const SeekLeadSeconds = 2;
const BibHitMargin = 0.01;

const pluralize = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

export const ViewerPageScreen = () => {
  const [controller] = useState(() => new VideoPlaybackController());
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const videoState = useVideoElementState(videoElement);

  const handleVideoElement = useCallback((video: HTMLVideoElement | null) => {
    controller.attach(video);
    setVideoElement(video);
  }, [controller]);

  const session = useViewerSession({
    controller,
  });

  const [swipeSpeed, setSwipeSpeed] = useLocalStorageState<number>({
    key: SwipeSpeedStorageKey,
    defaultValue: SwipeSpeedDefault,
  });
  const [storedSwipeReverse, setStoredSwipeReverse] = useLocalStorageState<boolean | number>({
    key: SwipeReverseStorageKey,
    defaultValue: false,
  });
  const isSwipeReversed = Boolean(storedSwipeReverse);

  useEffect(() => {
    controller.setSwipeSettings({
      speed: Number(swipeSpeed),
      isReversed: isSwipeReversed,
    });
  }, [controller, isSwipeReversed, swipeSpeed]);

  const [overlaySettings, setOverlaySettings] = useState<OverlaySettings>(DefaultOverlaySettings);
  const [isOverlayShown, setIsOverlayShown] = useState(true);
  const [isWide, setIsWide] = useState(false);
  const [runnerListFilters, setRunnerListFilters] = useState<RunnerListFilters>(DefaultRunnerListFilters);
  const [runnerListScope, setRunnerListScope] = useState<RunnerListScope>(RunnerListScope.ThisVideo);
  const [isClockDialogOpen, setIsClockDialogOpen] = useState(false);
  const [isBibNumbersDialogOpen, setIsBibNumbersDialogOpen] = useState(false);
  const [isBibDesignsDialogOpen, setIsBibDesignsDialogOpen] = useState(false);
  const [isClearScansDialogOpen, setIsClearScansDialogOpen] = useState(false);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const [isFinderShown, setIsFinderShown] = useState(false);
  const [clockDialogVideoTime, setClockDialogVideoTime] = useState(0);

  const videoFileInputRef = useRef<HTMLInputElement>(null);
  const resultsFileInputRef = useRef<HTMLInputElement>(null);

  const bibDesigns = useBibDesigns({
    isServerAvailable: session.isServerAvailable,
    mediaVideo: session.mediaVideo,
    pausedAt: videoState.pausedAt,
    isFinderShown,
  });

  const {
    eventSettingsGetQuery
  } = EventQueries.useGetSettings({
    enabled: session.isServerAvailable,
  });
  const eventSettings = eventSettingsGetQuery.data ?? null;
  const {
    eventSettingsSaveMutation
  } = EventMutations.useSaveSettings();

  const currentTime = useVideoTime(controller, 0.5);
  const currentSegment = segmentAt({
    segments: session.segments,
    time: currentTime,
  });

  const registered = session.detections?.registered;
  const visibleSightings = useMemo(() => filterRunners({
    sightings: session.sightings,
    filters: runnerListFilters,
    tags: session.tags,
    registered,
  }), [registered, runnerListFilters, session.sightings, session.tags]);

  const duration = videoState.duration || session.duration;
  const unscannedRanges = useMemo(() => unscannedRangesOf({
    detections: session.detections,
    duration,
  }), [duration, session.detections]);

  const sceneRef = useRef<OverlayScene>({
    frames: [],
    segments: [],
    sightings: [],
    crossedBibs: new Set(),
    targets: new Set(),
    isPeopleShown: true,
    isBibsShown: true,
    isEveryBibShown: true,
    finishLinePoints: null,
    picking: null,
    finder: null,
    templates: [],
    clockOffset: null,
    swipeFlashUntil: 0,
  });
  const scene: OverlayScene = {
    frames: session.frames,
    segments: session.segments,
    sightings: session.sightings,
    crossedBibs: session.crossedBibs,
    targets: session.targets,
    ...overlaySettings,
    finishLinePoints: session.finishLinePoints,
    picking: bibDesigns.picking,
    finder: bibDesigns.finder,
    templates: bibDesigns.templates,
    clockOffset: session.clockOffset,
    swipeFlashUntil: 0,
  };

  useLayoutEffect(() => {
    sceneRef.current = scene;
  });

  const libraryVideos: ViewerHeaderVideo[] = useMemo(() => {
    const overview = session.mediaOverview;
    if (!overview) {
      return [];
    }

    return overview.videos.map((name) => ({
      name,
      isScanned: Boolean(overview.scans?.[videoStem(name)]?.detections),
    }));
  }, [session.mediaOverview]);

  const cameraPositionCount = session.segments.length;
  const summaryText = session.videoSource
    ? `${pluralize(session.sightings.length, 'runner')} spotted · ${pluralize(cameraPositionCount, 'camera position')}`
    : null;

  const bibNumbersSummary = useMemo(() => {
    if (!eventSettings) {
      return '';
    }

    const digitsText = eventSettings.minDigits === eventSettings.maxDigits
      ? `${eventSettings.minDigits}`
      : `${eventSettings.minDigits}–${eventSettings.maxDigits}`;
    return `Who is running (${digitsText} digit bibs)`;
  }, [eventSettings]);

  const bibDesignsSummary = bibDesigns.templateIdsInUse.length
    ? `${pluralize(bibDesigns.templateIdsInUse.length, 'design')} in use`
    : 'Currently reading the whole frame · not needed for most races';

  const selectSighting = useCallback((sighting: SightingDto) => {
    controller.pause();
    controller.seekTo(Math.max(0, sightingTime(sighting) - SeekLeadSeconds));
    session.setSelectedKey(sightingKey(sighting));
  }, [controller, session]);

  const goToRunner = useCallback((direction: 1 | -1) => {
    const time = controller.currentTime;
    const times = visibleSightings.map((sighting) => sightingTime(sighting) - SeekLeadSeconds).sort((a, b) => a - b);
    const target = direction === 1
      ? times.find((candidate) => candidate > time + 0.05)
      : [...times].reverse().find((candidate) => candidate < time - 0.05);

    if (target === undefined) {
      return;
    }

    controller.seekTo(Math.max(0, target));
    const runner = visibleSightings.find((sighting) => sightingTime(sighting) - SeekLeadSeconds === target);
    if (runner) {
      session.setSelectedKey(sightingKey(runner));
    }
  }, [controller, session, visibleSightings]);

  const selectBibAt = useCallback((point: FramePoint) => {
    const frame = nearestFrame({
      frames: session.frames,
      time: controller.currentTime,
    });
    const hit = frame?.bibs.find((read) => isPointInBox({
      box: read.box,
      x: point.x,
      y: point.y,
      margin: BibHitMargin,
    }));

    if (!hit) {
      return;
    }

    const time = controller.currentTime;
    const distanceTo = (sighting: SightingDto) => Math.min(Math.abs(time - sighting.from), Math.abs(time - sighting.to));
    const closest = session.sightings
      .filter((sighting) => sighting.bib === hit.bib)
      .sort((a, b) => distanceTo(a) - distanceTo(b))[0];

    if (closest) {
      session.setSelectedKey(sightingKey(closest));
    }
  }, [controller, session]);

  const handleFrameClick = useCallback((point: FramePoint) => {
    if (bibDesigns.picking) {
      bibDesigns.pickAt({
        point,
        time: controller.currentTime,
      });
      return;
    }

    if (session.finishLinePoints) {
      session.addFinishLinePoint(point);
      return;
    }

    selectBibAt(point);
  }, [bibDesigns, controller, selectBibAt, session]);

  const openClockDialog = useCallback(() => {
    controller.pause();
    setClockDialogVideoTime(controller.currentTime);
    setIsClockDialogOpen(true);
  }, [controller]);

  const handleScanClick = () => {
    const willChangeReader = !session.isScanning
      && session.scanMadeWithPeopleFirst !== null
      && session.scanMadeWithPeopleFirst !== session.isPeopleFirst;

    if (!willChangeReader) {
      session.startScan(bibDesigns.templateIdsInUse);
      return;
    }

    const madeWith = session.scanMadeWithPeopleFirst ? 'with' : 'without';
    const scanWith = session.isPeopleFirst ? 'with' : 'without';
    setConfirmRequest({
      title: 'Scan the whole video again?',
      description: `This video’s saved scan was made ${madeWith} “Only look for people”. Scanning ${scanWith} it reads the whole video again from the start.`,
      confirmLabel: 'Scan again',
      onConfirm: () => session.startScan(bibDesigns.templateIdsInUse),
    });
  };

  const handleExportCsv = () => {
    if (!session.sightings.length) {
      toast.add({
        title: 'No runners to export yet',
        type: 'info',
      });
      return;
    }

    downloadFile({
      content: buildSightingsCsv({
        sightings: session.sightings,
        tags: session.tags,
        registered,
        clockOffset: session.clockOffset,
      }),
      fileName: `sightings_${videoStem(session.mediaVideo || session.videoSource?.name || 'video')}.csv`,
      type: 'text/csv',
    });
  };

  const handleSaveBibNumbers = async (settings: EventSettingsSaveRequestDto) => {
    try {
      await eventSettingsSaveMutation.mutateAsync(settings);
      setIsBibNumbersDialogOpen(false);
      toast.add({
        title: 'Bib numbers saved for this event',
        description: 'The next scan of each video reads it again with these rules.',
        type: 'success',
      });
    } catch (error) {
      toast.add({
        title: 'Could not save',
        description: error instanceof Error ? error.message : String(error),
        type: 'error',
      });
    }
  };

  const handleCalibrateDesign = (template: TemplateGetResponseDto) => {
    setIsBibDesignsDialogOpen(false);
    controller.pause();
    bibDesigns.startPicking({
      mode: BibDesignPickMode.Calibrate,
      templateId: template.id,
      name: template.name,
    });
  };

  const handleAddDesignFromVideo = () => {
    setIsBibDesignsDialogOpen(false);
    controller.pause();
    bibDesigns.startPicking({
      mode: BibDesignPickMode.New,
    });
  };

  const handleRemoveDesign = (template: TemplateGetResponseDto) => {
    setConfirmRequest({
      title: `Remove the bib design “${template.name}”?`,
      description: 'Scans already made keep their results.',
      confirmLabel: 'Remove',
      isDestructive: true,
      onConfirm: () => bibDesigns.removeTemplate(template.id),
    });
  };

  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (file) {
      session.openFile(file);
    }
  };

  const handleEscape = useCallback(() => {
    bibDesigns.stopPicking();
    session.cancelFinishLineMarking();
  }, [bibDesigns, session]);

  useViewerShortcuts({
    controller,
    actions: {
      onPreviousRunner: () => goToRunner(-1),
      onNextRunner: () => goToRunner(1),
      onToggleFinishLineMarking: session.toggleFinishLineMarking,
      onSplitCameraPosition: session.splitSegmentHere,
      onToggleTag: session.toggleTag,
      onEscape: handleEscape,
    },
  });

  const {
    openFile,
    openFromQuery
  } = session;
  const hasOpenedFromQueryRef = useRef(false);

  useEffect(() => {
    if (hasOpenedFromQueryRef.current) {
      return;
    }

    hasOpenedFromQueryRef.current = true;
    openFromQuery();
  }, [openFromQuery]);

  useEffect(() => {
    const preventDefault = (event: DragEvent) => {
      event.preventDefault();
    };
    const handleDrop = (event: DragEvent) => {
      event.preventDefault();
      [...(event.dataTransfer?.files ?? [])].forEach((file) => openFile(file));
    };

    document.addEventListener('dragover', preventDefault);
    document.addEventListener('drop', handleDrop);

    return () => {
      document.removeEventListener('dragover', preventDefault);
      document.removeEventListener('drop', handleDrop);
    };
  }, [openFile]);

  const isPicking = Boolean(bibDesigns.picking) || Boolean(session.finishLinePoints);
  const hasVideo = session.videoSource !== null;

  const moreMenu = (
    <ViewerMoreMenu
      isEventAvailable={session.isServerAvailable && eventSettings !== null}
      bibNumbersSummary={bibNumbersSummary}
      bibDesignsSummary={bibDesignsSummary}
      hasVideo={hasVideo}
      canClearScans={session.isServerAvailable && Boolean(session.mediaVideo) && !session.isScanning}
      isPeopleFirst={session.isPeopleFirst}
      overlaySettings={overlaySettings}
      swipeSpeed={Number(swipeSpeed)}
      isSwipeReversed={isSwipeReversed}
      onOpenVideoFile={() => videoFileInputRef.current?.click()}
      onImportResults={() => resultsFileInputRef.current?.click()}
      onOpenBibNumbers={() => setIsBibNumbersDialogOpen(true)}
      onOpenBibDesigns={() => setIsBibDesignsDialogOpen(true)}
      onSetRaceClock={openClockDialog}
      onSplitCameraPosition={session.splitSegmentHere}
      onDownloadSegments={session.exportSegments}
      onPeopleFirstChange={session.setIsPeopleFirst}
      onOverlaySettingsChange={setOverlaySettings}
      onSwipeSpeedChange={setSwipeSpeed}
      onSwipeReversedChange={setStoredSwipeReverse}
      onClearScans={() => setIsClearScansDialogOpen(true)}
    />
  );

  return (
    <div className="flex min-h-screen flex-col bg-muted/50">
      <ViewerHeader
        videos={libraryVideos}
        selectedVideoName={session.videoSource?.name ?? null}
        summaryText={summaryText}
        saveState={session.autosaveStatus}
        saveErrorMessage={session.autosaveErrorMessage}
        scanStatusText={session.scanStatusText}
        scanProgress={session.scanProgress}
        scanButtonLabel={session.scanButtonLabel}
        isScanButtonShown={session.isServerAvailable}
        isScanButtonDisabled={!session.canScan}
        isScanning={session.isScanning}
        onSelectVideo={session.openLibraryVideo}
        onScanClick={handleScanClick}
        actions={moreMenu}
      />

      <main
        className={cn(
          'mx-auto grid w-full max-w-screen-2xl flex-1 gap-6 p-3 sm:p-6',
          !isWide && 'lg:grid-cols-[minmax(0,1fr)_22rem]',
        )}
      >
        <div className="flex min-w-0 flex-col gap-4">
          {hasVideo && (
            <VideoPlayerCard
              controller={controller}
              sceneRef={sceneRef}
              videoSrc={session.videoSource?.src ?? ''}
              onVideoElement={handleVideoElement}
              isPlaying={videoState.isPlaying}
              duration={duration}
              playbackRate={videoState.playbackRate}
              clockOffset={session.clockOffset}
              isOverlayShown={isOverlayShown}
              isPicking={isPicking}
              isWide={isWide}
              onToggleOverlay={() => setIsOverlayShown(!isOverlayShown)}
              onToggleWide={() => setIsWide(!isWide)}
              onSetClock={openClockDialog}
              onFrameClick={handleFrameClick}
            />
          )}

          {!hasVideo && (
            <EmptyViewerState
              videos={libraryVideos}
              isServerAvailable={session.isServerAvailable}
              onSelectVideo={session.openLibraryVideo}
              onOpenVideoFile={() => videoFileInputRef.current?.click()}
              onImportResults={() => resultsFileInputRef.current?.click()}
            />
          )}

          <RaceTimelineCard
            controller={controller}
            duration={duration}
            isPlaying={videoState.isPlaying}
            sightings={session.sightings}
            segments={session.segments}
            unscannedRanges={unscannedRanges}
            readingAt={session.readingAt}
            selectedKey={session.selectedKey}
            onSelectSighting={selectSighting}
          />

          <MarkAndAnnotateBar
            isMarkingFinishLine={session.finishLinePoints !== null}
            hasRunners={visibleSightings.length > 0}
            onPreviousRunner={() => goToRunner(-1)}
            onNextRunner={() => goToRunner(1)}
            onMarkFinishLine={session.toggleFinishLineMarking}
            onSplitCameraPosition={session.splitSegmentHere}
          />
        </div>

        <aside className={cn('h-144 min-h-0', !isWide && 'lg:sticky lg:top-20 lg:h-[calc(100vh-6.5rem)]')}>
          <RunnersSpottedPanel
            totalCount={session.sightings.length}
            visibleSightings={visibleSightings}
            filters={runnerListFilters}
            onFiltersChange={setRunnerListFilters}
            scope={runnerListScope}
            onScopeChange={setRunnerListScope}
            isServerAvailable={session.isServerAvailable}
            currentSegment={currentSegment}
            currentTime={currentTime}
            selectedKey={session.selectedKey}
            tags={session.tags}
            registered={registered}
            clockOffset={session.clockOffset}
            onSelectSighting={selectSighting}
            onToggleTag={session.toggleTag}
            onExportCsv={handleExportCsv}
            onMarkFinishLine={session.toggleFinishLineMarking}
            onOpenSearchResult={session.openSearchResult}
          />
        </aside>
      </main>

      <input
        ref={videoFileInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleFileInputChange}
      />
      <input
        ref={resultsFileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleFileInputChange}
      />

      <RaceClockDialog
        isOpen={isClockDialogOpen}
        videoTime={clockDialogVideoTime}
        clockOffset={session.clockOffset}
        onOpenChange={setIsClockDialogOpen}
        onSave={session.saveClock}
      />

      <BibNumbersDialog
        isOpen={isBibNumbersDialogOpen}
        eventSettings={eventSettings}
        isSaving={eventSettingsSaveMutation.isPending}
        onOpenChange={setIsBibNumbersDialogOpen}
        onSave={handleSaveBibNumbers}
      />

      <BibDesignsDialog
        isOpen={isBibDesignsDialogOpen}
        templates={bibDesigns.templates}
        templateIdsInUse={bibDesigns.templateIdsInUse}
        isFinderShown={isFinderShown}
        onOpenChange={setIsBibDesignsDialogOpen}
        onTemplateInUseChange={bibDesigns.setTemplateInUse}
        onCalibrate={handleCalibrateDesign}
        onRemove={handleRemoveDesign}
        onAddFromImage={bibDesigns.addFromImage}
        onAddFromVideo={handleAddDesignFromVideo}
        onFinderShownChange={setIsFinderShown}
      />

      <BibDesignDetailsDialog
        isOpen={bibDesigns.pendingDesign !== null}
        defaultMaxBib={session.detections?.maxBib || DefaultMaxBib}
        onCancel={bibDesigns.cancelPendingDesign}
        onSave={bibDesigns.createPendingDesign}
      />

      <ClearScansDialog
        isOpen={isClearScansDialogOpen}
        videoName={session.mediaVideo ?? ''}
        durationSeconds={duration}
        onOpenChange={setIsClearScansDialogOpen}
        onClear={session.clearScans}
      />

      <ConfirmDialog
        request={confirmRequest}
        onClose={() => setConfirmRequest(null)}
      />
    </div>
  );
};
