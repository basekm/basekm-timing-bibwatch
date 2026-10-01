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
  RunnerListScope,
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
  nearestFrame
} from '@basekm/@shared/utils/frameGeometry';
import {
  sightingKey
} from '@basekm/@shared/utils/sightingTags';
import {
  EventMutations,
  EventQueries
} from '@basekm/api';
import {
  OpenFolderDialog
} from '@basekm/components/OpenFolderDialog';
import {
  ViewerHeader,
  ViewerHeaderVideo
} from '@basekm/components/ViewerHeader';
import {
  EventSettingsSaveRequestDto,
  SightingDto
} from '@basekm/dtos';
import {
  useLocalStorageState
} from '@basekm/hooks/use-local-storage-state';
import {
  useVideoElementState
} from '@basekm/hooks/use-video-element-state';

import {
  AddRunnerDialog,
  PersonToAdd
} from './components/AddRunnerDialog';
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
  hitTestFrame,
  VideoHitKind
} from './utils/videoHitTest';
import {
  VideoPlaybackController
} from './utils/VideoPlaybackController';

const DefaultRunnerListFilters: RunnerListFilters = {
  search: '',
  direction: AnyDirectionValue,
};

const DefaultOverlaySettings: OverlaySettings = {
  isPeopleShown: true,
  isBibsShown: true,
  isEveryBibShown: true,
};

const SeekLeadSeconds = 2;

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

  useEffect(() => {
    controller.setSwipeSettings({
      speed: Number(swipeSpeed),
    });
  }, [controller, swipeSpeed]);

  const [overlaySettings, setOverlaySettings] = useState<OverlaySettings>(DefaultOverlaySettings);
  const [isOverlayShown, setIsOverlayShown] = useState(true);
  const [isWide, setIsWide] = useState(false);
  const [runnerListFilters, setRunnerListFilters] = useState<RunnerListFilters>(DefaultRunnerListFilters);
  const [runnerListScope, setRunnerListScope] = useState<RunnerListScope>(RunnerListScope.ThisVideo);
  const [isClockDialogOpen, setIsClockDialogOpen] = useState(false);
  const [isBibNumbersDialogOpen, setIsBibNumbersDialogOpen] = useState(false);
  const [isClearScansDialogOpen, setIsClearScansDialogOpen] = useState(false);
  const [isOpenFolderDialogOpen, setIsOpenFolderDialogOpen] = useState(false);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const [clockDialogVideoTime, setClockDialogVideoTime] = useState(0);
  const [personToAdd, setPersonToAdd] = useState<PersonToAdd | null>(null);

  const videoFileInputRef = useRef<HTMLInputElement>(null);

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

  const bibNumbersSummary = useMemo(() => {
    if (!eventSettings) {
      return '';
    }

    const digitsText = eventSettings.minDigits === eventSettings.maxDigits
      ? `${eventSettings.minDigits}`
      : `${eventSettings.minDigits}–${eventSettings.maxDigits}`;
    return `Who is running (${digitsText} digit bibs)`;
  }, [eventSettings]);

  const selectSighting = useCallback((sighting: SightingDto) => {
    controller.pause();
    controller.seekTo(Math.max(0, sightingTime(sighting) - SeekLeadSeconds));
    session.setSelectedKey(sightingKey(sighting));
  }, [controller, session]);

  const runnerBibs = useMemo(() => new Set(session.sightings.map((sighting) => sighting.bib)), [session.sightings]);

  const isBibClickable = useCallback((bib: string) => {
    const isDrawn = overlaySettings.isBibsShown
      && (overlaySettings.isEveryBibShown || session.targets.has(bib) || session.crossedBibs.has(bib));
    return isDrawn && runnerBibs.has(bib);
  }, [overlaySettings.isBibsShown, overlaySettings.isEveryBibShown, runnerBibs, session.crossedBibs, session.targets]);

  const hitAt = useCallback((point: FramePoint) => {
    if (!isOverlayShown) {
      return null;
    }

    return hitTestFrame({
      frame: nearestFrame({
        frames: session.frames,
        time: controller.currentTime,
      }),
      point,
      isPeopleClickable: overlaySettings.isPeopleShown && session.canAddRunners,
      isBibClickable,
    });
  }, [controller, isBibClickable, isOverlayShown, overlaySettings.isPeopleShown, session.canAddRunners, session.frames]);

  const isClickableAt = useCallback((point: FramePoint) => hitAt(point) !== null, [hitAt]);

  const selectRunnerAt = useCallback((point: FramePoint | null) => {
    const hit = point ? hitAt(point) : null;

    if (!hit) {
      controller.togglePlay();
      return;
    }

    if (hit.kind === VideoHitKind.Person) {
      controller.pause();
      setPersonToAdd({
        t: hit.t,
        box: hit.box,
      });
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
  }, [controller, hitAt, session]);

  const handleAddRunner = (bib: string) => {
    if (!personToAdd) {
      return;
    }

    session.addRunner({
      bib,
      t: personToAdd.t,
      box: personToAdd.box,
    });
  };

  const handleFrameClick = useCallback((point: FramePoint | null) => {
    if (session.finishLinePoints) {
      if (point) {
        session.addFinishLinePoint(point);
      }
      return;
    }

    selectRunnerAt(point);
  }, [selectRunnerAt, session]);

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
      session.startScan();
      return;
    }

    const madeWith = session.scanMadeWithPeopleFirst ? 'with' : 'without';
    const scanWith = session.isPeopleFirst ? 'with' : 'without';
    setConfirmRequest({
      title: 'Scan the whole video again?',
      description: `This video’s saved scan was made ${madeWith} “Only look for people”. Scanning ${scanWith} it reads the whole video again from the start.`,
      confirmLabel: 'Scan again',
      onConfirm: () => session.startScan(),
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

  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (file) {
      session.openFile(file);
    }
  };

  const handleEscape = useCallback(() => {
    session.cancelFinishLineMarking();
  }, [session]);

  useViewerShortcuts({
    controller,
    actions: {
      onToggleFinishLineMarking: session.toggleFinishLineMarking,
      onSplitCameraPosition: session.splitSegmentHere,
      onToggleTag: session.toggleTag,
      onEscape: handleEscape,
    },
  });

  const pendingSeekRef = useRef<number | null>(null);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const seekTime = Number(query.get('t'));
    if (!query.has('camera') || !Number.isFinite(seekTime)) {
      return;
    }

    pendingSeekRef.current = seekTime;
  }, []);

  useEffect(() => {
    if (!videoElement || pendingSeekRef.current === null) {
      return;
    }

    const seekToPending = () => {
      if (pendingSeekRef.current === null) {
        return;
      }
      controller.seekTo(pendingSeekRef.current);
      pendingSeekRef.current = null;
    };

    if (videoElement.readyState >= 1) {
      seekToPending();
      return;
    }

    videoElement.addEventListener('loadedmetadata', seekToPending, {
      once: true,
    });

    return () => {
      videoElement.removeEventListener('loadedmetadata', seekToPending);
    };
  }, [controller, videoElement]);

  const {
    openFile,
    openFromQuery,
    restoreSelectedVideo
  } = session;
  const isMediaOverviewLoaded = session.mediaOverview !== null;
  const hasOpenedFromQueryRef = useRef(false);
  const hasRestoredVideoRef = useRef(false);

  useEffect(() => {
    if (hasOpenedFromQueryRef.current) {
      return;
    }

    hasOpenedFromQueryRef.current = true;
    openFromQuery();
  }, [openFromQuery]);

  useEffect(() => {
    if (hasRestoredVideoRef.current || !isMediaOverviewLoaded) {
      return;
    }

    hasRestoredVideoRef.current = true;
    restoreSelectedVideo();
  }, [isMediaOverviewLoaded, restoreSelectedVideo]);

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

  const isPicking = Boolean(session.finishLinePoints);
  const hasVideo = session.videoSource !== null;

  const moreMenu = (
    <ViewerMoreMenu
      isEventAvailable={session.isServerAvailable && eventSettings !== null}
      bibNumbersSummary={bibNumbersSummary}
      hasVideo={hasVideo}
      canClearScans={session.isServerAvailable && Boolean(session.mediaVideo) && !session.isScanning}
      isPeopleFirst={session.isPeopleFirst}
      overlaySettings={overlaySettings}
      swipeSpeed={Number(swipeSpeed)}
      isFolderAvailable={session.mediaOverview !== null}
      onOpenFolder={() => setIsOpenFolderDialogOpen(true)}
      onOpenVideoFile={() => videoFileInputRef.current?.click()}
      onOpenBibNumbers={() => setIsBibNumbersDialogOpen(true)}
      onSetRaceClock={openClockDialog}
      onExportCsv={handleExportCsv}
      onDownloadSegments={session.exportSegments}
      onPeopleFirstChange={session.setIsPeopleFirst}
      onOverlaySettingsChange={setOverlaySettings}
      onSwipeSpeedChange={setSwipeSpeed}
      onClearScans={() => setIsClearScansDialogOpen(true)}
    />
  );

  return (
    <div className="flex min-h-screen flex-col bg-muted/50">
      <ViewerHeader
        folderName={session.folder?.name ?? null}
        isFolderButtonShown={session.mediaOverview !== null}
        videos={libraryVideos}
        selectedVideoName={session.videoSource?.name ?? null}
        saveState={session.autosaveStatus}
        saveErrorMessage={session.autosaveErrorMessage}
        scanStatusText={session.scanStatusText}
        scanProgress={session.scanProgress}
        scanButtonLabel={session.scanButtonLabel}
        isScanButtonShown={session.isServerAvailable}
        isScanButtonDisabled={!session.canScan}
        isScanning={session.isScanning}
        onOpenFolderClick={() => setIsOpenFolderDialogOpen(true)}
        onSelectVideo={session.openLibraryVideo}
        onScanClick={handleScanClick}
        actions={moreMenu}
      />

      <main
        className={cn(
          'grid w-full flex-1 content-start gap-4 p-3 sm:p-6',
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
              isMarkingFinishLine={session.finishLinePoints !== null}
              onToggleOverlay={() => setIsOverlayShown(!isOverlayShown)}
              onToggleWide={() => setIsWide(!isWide)}
              onToggleFinishLineMarking={session.toggleFinishLineMarking}
              onCameraMoved={session.splitSegmentHere}
              onSetClock={openClockDialog}
              onFrameClick={handleFrameClick}
              isClickableAt={isClickableAt}
            />
          )}

          {!hasVideo && (
            <EmptyViewerState
              videos={libraryVideos}
              folderName={session.folder?.name ?? null}
              isServerUp={session.mediaOverview !== null}
              onSelectVideo={session.openLibraryVideo}
              onOpenFolder={() => setIsOpenFolderDialogOpen(true)}
              onOpenVideoFile={() => videoFileInputRef.current?.click()}
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
        </div>

        <aside className={cn('relative h-144 min-h-0', !isWide && 'lg:h-auto')}>
          <div className={cn('h-full', !isWide && 'lg:absolute lg:inset-0')}>
            <RunnersSpottedPanel
              visibleSightings={visibleSightings}
              filters={runnerListFilters}
              onFiltersChange={setRunnerListFilters}
              scope={runnerListScope}
              onScopeChange={setRunnerListScope}
              isServerAvailable={session.isServerAvailable}
              currentTime={currentTime}
              selectedKey={session.selectedKey}
              tags={session.tags}
              registered={registered}
              clockOffset={session.clockOffset}
              onSelectSighting={selectSighting}
              onToggleTag={session.toggleTag}
              onRemoveRunner={session.removeRunner}
              onOpenSearchResult={session.openSearchResult}
            />
          </div>
        </aside>
      </main>

      <input
        ref={videoFileInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleFileInputChange}
      />

      <AddRunnerDialog
        person={personToAdd}
        video={controller.video}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setPersonToAdd(null);
          }
        }}
        onAdd={handleAddRunner}
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
      <ClearScansDialog
        isOpen={isClearScansDialogOpen}
        videoName={session.mediaVideo ?? ''}
        durationSeconds={duration}
        onOpenChange={setIsClearScansDialogOpen}
        onClear={session.clearScans}
      />

      <OpenFolderDialog
        isOpen={isOpenFolderDialogOpen}
        isOpening={session.isOpeningFolder}
        onOpenChange={setIsOpenFolderDialogOpen}
        onOpenFolder={session.openFolder}
      />

      <ConfirmDialog
        request={confirmRequest}
        onClose={() => setConfirmRequest(null)}
      />
    </div>
  );
};
