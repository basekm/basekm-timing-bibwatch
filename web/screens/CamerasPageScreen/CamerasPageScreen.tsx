'use client';

import {
  CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';

import {
  ArrowLeftIcon,
  ChevronDownIcon,
  SquareDashedIcon
} from 'lucide-react';
import Link from 'next/link';
import {
  useRouter
} from 'next/navigation';

import {
  Button
} from '@/components/ui/button';
import {
  Card
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  toast
} from '@/components/ui/toast';
import {
  Toggle
} from '@/components/ui/toggle';

import {
  videoStem
} from '@basekm/@shared/utils/downloadFile';
import {
  MediaMutations,
  MediaQueries,
  SightingsQueries
} from '@basekm/api';
import {
  AppHeader
} from '@basekm/components/ViewerHeader';
import {
  useLocalStorageState
} from '@basekm/hooks/use-local-storage-state';
import {
  RaceClockDialog
} from '@basekm/screens/ViewerPageScreen/components/RaceClockDialog';

import {
  CameraLayoutMenu
} from './components/CameraLayoutMenu';
import {
  CamerasRunnersPanel
} from './components/CamerasRunnersPanel';
import {
  CamerasTimeline
} from './components/CamerasTimeline';
import {
  CameraMoment,
  CameraTile
} from './components/CameraTile';
import {
  useBestGrid
} from './hooks/useBestGrid';
import {
  useCameraSync
} from './hooks/useCameraSync';
import {
  CameraLayout,
  CameraLayoutMode,
  gridForLayout,
  layoutOfValue,
  layoutValueOf
} from './utils/cameraGridLayout';
import {
  CameraSyncController,
  rangeOf,
  SyncedCamera
} from './utils/CameraSyncController';
import {
  CameraSighting,
  mergeCameraSightings
} from './utils/mergeCameraSightings';

type ClockDialogRequest = CameraMoment & {
  clockOffset: number | null;
};

type CameraClock = {
  name: string;
  clockOffset: number;
};

type CameraDuration = {
  name: string;
  duration: number;
};

type CameraShown = {
  name: string;
  isShown: boolean;
};

const SelectedCamerasStorageKey = 'bibwatch.cameras.selected';
const RaceTimeStorageKey = 'bibwatch.cameras.raceTime';
const LayoutStorageKey = 'bibwatch.cameras.layout';
const BoxesShownStorageKey = 'bibwatch.cameras.boxesShown';
const DefaultCameraCount = 2;
const CameraGapPx = 12;
const RaceClockResolutionSeconds = 0.1;
const SightingsRefreshMs = 5000;
const SeekLeadSeconds = 2;

const StepSecondsByKey: Record<string, number> = {
  ArrowLeft: -5,
  ArrowRight: 5,
  ',': -0.1,
  '.': 0.1,
};

const readStoredRaceTime = () => {
  try {
    const storedRaceTime = Number(window.sessionStorage.getItem(RaceTimeStorageKey));
    const isUsable = Number.isFinite(storedRaceTime) && storedRaceTime > 0;
    return isUsable ? storedRaceTime : null;
  } catch {
    return null;
  }
};

const writeStoredRaceTime = (raceTime: number) => {
  try {
    window.sessionStorage.setItem(RaceTimeStorageKey, String(raceTime));
  } catch {
    return;
  }
};

const isTypingTarget = (target: EventTarget | null) => {
  const element = target as HTMLElement | null;
  return Boolean(element?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]'));
};

export const CamerasPageScreen = () => {
  const router = useRouter();
  const [controller] = useState(() => new CameraSyncController());
  const sync = useCameraSync({
    controller,
    resolutionSeconds: RaceClockResolutionSeconds,
  });

  const {
    mediaOverviewGetQuery
  } = MediaQueries.useGetOverview();
  const overview = mediaOverviewGetQuery.data ?? null;
  const {
    videoClockSaveMutation
  } = MediaMutations.useSaveClock();

  const [storedSelection, setStoredSelection] = useLocalStorageState<string[] | null>({
    key: SelectedCamerasStorageKey,
    defaultValue: null,
  });
  const [storedLayout, setStoredLayout] = useLocalStorageState<string>({
    key: LayoutStorageKey,
    defaultValue: CameraLayoutMode.Auto,
  });
  const [isBoxesShown, setIsBoxesShown] = useLocalStorageState<boolean>({
    key: BoxesShownStorageKey,
    defaultValue: true,
  });
  const [durations, setDurations] = useState<Record<string, number>>({});
  const [savedClocks, setSavedClocks] = useState<Record<string, number>>({});
  const [liningUp, setLiningUp] = useState<string[]>([]);
  const [clockDialog, setClockDialog] = useState<ClockDialogRequest | null>(null);
  const [runnerSearch, setRunnerSearch] = useState('');
  const [selectedSightingKey, setSelectedSightingKey] = useState<string | null>(null);

  const gridRef = useRef<HTMLDivElement>(null);
  const hasPlacedRaceClockRef = useRef(false);

  const libraryVideos = useMemo(() => overview?.videos ?? [], [overview]);

  const clocks = useMemo(() => ({
    ...(overview?.clocks ?? {}),
    ...savedClocks,
  }), [overview, savedClocks]);

  const selectedNames = useMemo(() => {
    if (storedSelection) {
      return storedSelection.filter((name) => libraryVideos.includes(name));
    }

    const videosWithClock = libraryVideos.filter((name) => clocks[name] !== undefined);
    const hasEnoughWithClock = videosWithClock.length >= DefaultCameraCount;
    return hasEnoughWithClock ? videosWithClock : libraryVideos.slice(0, DefaultCameraCount);
  }, [clocks, libraryVideos, storedSelection]);

  const cameras: SyncedCamera[] = useMemo(() => selectedNames.map((name) => ({
    name,
    clockOffset: clocks[name] ?? null,
    duration: durations[name] ?? null,
  })), [clocks, durations, selectedNames]);

  const followingCameras = useMemo(
    () => cameras.filter((camera) => !liningUp.includes(camera.name)),
    [cameras, liningUp],
  );
  const range = useMemo(() => rangeOf(followingCameras), [followingCameras]);

  const {
    sightingsByVideo
  } = SightingsQueries.useGetByVideos(selectedNames, {
    refetchInterval: SightingsRefreshMs,
  });

  const cameraSightings = useMemo(() => mergeCameraSightings({
    resultsByVideo: sightingsByVideo.resultsByVideo,
    clocks,
  }), [clocks, sightingsByVideo.resultsByVideo]);

  const bestGrid = useBestGrid({
    containerRef: gridRef,
    count: cameras.length,
    gapPx: CameraGapPx,
  });
  const layout = layoutOfValue(storedLayout);
  const grid = gridForLayout({
    layout,
    cameraCount: cameras.length,
    bestGrid,
  });

  useEffect(() => {
    const isFirstPick = !storedSelection && overview !== null && selectedNames.length > 0;
    if (isFirstPick) {
      setStoredSelection(selectedNames);
    }
  }, [overview, selectedNames, setStoredSelection, storedSelection]);

  useEffect(() => {
    controller.setCameras(followingCameras);
  }, [controller, followingCameras]);

  useEffect(() => {
    cameras.forEach((camera) => controller.setDetached({
      name: camera.name,
      isDetached: liningUp.includes(camera.name),
    }));
  }, [cameras, controller, liningUp]);

  useEffect(() => {
    if (!range) {
      return;
    }

    if (!hasPlacedRaceClockRef.current) {
      hasPlacedRaceClockRef.current = true;
      controller.seekTo(readStoredRaceTime() ?? range.from);
      return;
    }

    const isOutsideRange = controller.raceTime < range.from || controller.raceTime > range.to;
    if (isOutsideRange) {
      controller.seekTo(range.from);
    }
  }, [controller, range]);

  useEffect(() => () => controller.dispose(), [controller]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const hasModifier = event.metaKey || event.ctrlKey || event.altKey;
      if (isTypingTarget(event.target) || hasModifier) {
        return;
      }

      if (event.key === ' ') {
        event.preventDefault();
        controller.togglePlay();
        return;
      }

      const stepSeconds = StepSecondsByKey[event.key];
      if (stepSeconds !== undefined) {
        event.preventDefault();
        controller.step(stepSeconds);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [controller]);

  const toggleCamera = ({
    name,
    isShown,
  }: CameraShown) => {
    const nextNames = isShown
      ? [...selectedNames, name]
      : selectedNames.filter((selectedName) => selectedName !== name);
    setStoredSelection(libraryVideos.filter((videoName) => nextNames.includes(videoName)));
  };

  const handleDuration = useCallback(({
    name,
    duration,
  }: CameraDuration) => {
    if (!Number.isFinite(duration)) {
      return;
    }

    setDurations((previous) => {
      if (previous[name] === duration) {
        return previous;
      }

      return {
        ...previous,
        [name]: duration,
      };
    });
  }, []);

  const handleOpen = useCallback(({
    name,
    videoTime,
  }: CameraMoment) => {
    controller.pause();
    writeStoredRaceTime(controller.raceTime);

    const query = new URLSearchParams({
      camera: name,
      t: videoTime.toFixed(1),
    });
    router.push(`/?${query.toString()}`);
  }, [controller, router]);

  const startLiningUp = (name: string) => {
    controller.pause();
    setLiningUp((previous) => [...previous, name]);
  };

  const stopLiningUp = (name: string) => {
    setLiningUp((previous) => previous.filter((liningUpName) => liningUpName !== name));
  };

  const saveClock = async ({
    name,
    clockOffset,
  }: CameraClock) => {
    setSavedClocks((previous) => ({
      ...previous,
      [name]: clockOffset,
    }));
    stopLiningUp(name);

    try {
      await videoClockSaveMutation.mutateAsync({
        video: name,
        clockOffset,
      });
    } catch (error) {
      toast.add({
        title: `Could not save the race clock of ${name}`,
        description: error instanceof Error ? error.message : String(error),
        type: 'error',
      });
    }
  };

  const matchRaceClock = ({
    name,
    videoTime,
  }: CameraMoment) => {
    saveClock({
      name,
      clockOffset: controller.raceTime - videoTime,
    });
  };

  const openClockDialog = ({
    name,
    videoTime,
  }: CameraMoment) => {
    controller.pause();
    setClockDialog({
      name,
      videoTime,
      clockOffset: clocks[name] ?? null,
    });
  };

  const selectCameraSighting = (cameraSighting: CameraSighting) => {
    controller.pause();
    controller.seekTo(cameraSighting.raceTime - SeekLeadSeconds);
    setSelectedSightingKey(cameraSighting.key);
  };

  const changeLayout = (nextLayout: CameraLayout) => {
    setStoredLayout(layoutValueOf(nextLayout));
  };

  const handleClockDialogOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setClockDialog(null);
    }
  };

  const handleClockDialogSave = (clockOffset: number) => {
    if (clockDialog) {
      saveClock({
        name: clockDialog.name,
        clockOffset,
      });
    }
  };

  const runnerSearchText = runnerSearch.trim();
  const shownSightings = cameraSightings.filter((cameraSighting) => cameraSighting.sighting.bib.includes(runnerSearchText));
  const unlinkedCameraCount = cameras.filter((camera) => camera.clockOffset === null).length;

  const isServerDown = mediaOverviewGetQuery.isError;
  const hasCameras = cameras.length > 0;
  const isEmpty = !isServerDown && overview !== null && !hasCameras;
  const hasUnlinkedCamera = cameras.some((camera) => camera.clockOffset === null);
  const matchHintText = 'Cameras without a race clock play on their own. Move one to the moment the others show and press “Match” to link it.';
  const firstClockHintText = 'Set the race clock on one camera first. The others can then be matched to it.';
  const unlinkedHintText = (range && matchHintText) || firstClockHintText;
  const selectedCountText = `${selectedNames.length} of ${libraryVideos.length} videos`;
  const cameraGridStyle = {
    '--camera-columns': `repeat(${grid.columns}, minmax(0, 1fr))`,
    '--camera-rows': `repeat(${grid.rows}, minmax(0, 1fr))`,
  } as CSSProperties;

  return (
    <div className="flex min-h-screen flex-col bg-muted/50 lg:h-dvh">
      <AppHeader
        actions={(
          <>
            {hasCameras && (
              <Toggle
                variant="outline"
                size="sm"
                className="font-bold"
                title="Boxes and bib numbers on every camera"
                pressed={isBoxesShown}
                onPressedChange={setIsBoxesShown}
              >
                <SquareDashedIcon strokeWidth={2.5} />
                <span className="hidden sm:inline">Boxes</span>
              </Toggle>
            )}

            {hasCameras && (
              <CameraLayoutMenu
                layout={layout}
                cameraCount={cameras.length}
                onLayoutChange={changeLayout}
              />
            )}

            <Button
              variant="outline"
              size="sm"
              className="font-bold"
              title="Back to one video with its runners"
              render={<Link href="/" />}
              nativeButton={false}
            >
              <ArrowLeftIcon data-icon="inline-start" />
              <span className="hidden sm:inline">Viewer</span>
            </Button>
          </>
        )}
      >
        <div className="flex min-w-0 items-center gap-2 text-xs font-semibold">
          <span className="hidden text-muted-foreground sm:inline">Cameras:</span>

          {libraryVideos.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={(
                  <Button
                    variant="outline"
                    size="sm"
                    className="max-w-56 justify-between gap-1.5 font-bold sm:max-w-72"
                  />
                )}
              >
                <span className="truncate">{selectedCountText}</span>
                <ChevronDownIcon data-icon="inline-end" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="max-h-96 w-80">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Videos to watch together</DropdownMenuLabel>
                  {libraryVideos.map((name) => (
                    <DropdownMenuCheckboxItem
                      key={name}
                      checked={selectedNames.includes(name)}
                      closeOnClick={false}
                      onCheckedChange={(isChecked) => toggleCamera({
                        name,
                        isShown: isChecked,
                      })}
                    >
                      <span
                        className="min-w-0 truncate"
                        title={name}
                      >
                        {name}
                      </span>
                      {clocks[name] === undefined && (
                        <span className="ml-auto shrink-0 text-xs whitespace-nowrap text-muted-foreground">no race clock</span>
                      )}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </AppHeader>

      <main className="grid w-full flex-1 content-start gap-3 p-3 sm:p-4 lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_22rem] lg:content-stretch">
        <div className="flex min-w-0 flex-col gap-3 lg:min-h-0">
          {isServerDown && (
            <Card className="p-6 text-sm text-muted-foreground">
            The bibwatch server isn’t reachable, so the videos in the folder can’t be listed.
            </Card>
          )}

          {isEmpty && (
            <Card className="p-6 text-sm text-muted-foreground">
              {overview?.folder
                ? 'Pick the videos to watch together from the Cameras menu at the top.'
                : 'No folder is open yet: open the folder with the race videos in the Viewer first.'}
            </Card>
          )}

          {hasCameras && (
            <>
              {hasUnlinkedCamera && (
                <p className="shrink-0 text-sm text-muted-foreground">{unlinkedHintText}</p>
              )}

              <div
                ref={gridRef}
                className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:min-h-0 lg:flex-1 lg:grid-cols-(--camera-columns) lg:grid-rows-(--camera-rows)"
                style={cameraGridStyle}
              >
                {cameras.map((camera) => {
                  const isCameraLiningUp = liningUp.includes(camera.name);
                  const otherCameras = followingCameras.filter((followingCamera) => followingCamera.name !== camera.name);
                  const hasRaceClock = rangeOf(otherCameras) !== null;
                  const scanFiles = overview?.scans?.[videoStem(camera.name)] ?? null;

                  return (
                    <CameraTile
                      key={camera.name}
                      camera={camera}
                      controller={controller}
                      raceTime={sync.raceTime}
                      hasRaceClock={hasRaceClock}
                      isLiningUp={isCameraLiningUp}
                      scanFiles={scanFiles}
                      isBoxesShown={isBoxesShown}
                      onDuration={handleDuration}
                      onOpen={handleOpen}
                      onStartLineUp={startLiningUp}
                      onCancelLineUp={stopLiningUp}
                      onMatchRaceClock={matchRaceClock}
                      onSetClock={openClockDialog}
                      onRemove={(name) => toggleCamera({
                        name,
                        isShown: false,
                      })}
                    />
                  );
                })}
              </div>

              <CamerasTimeline
                controller={controller}
                cameras={cameras}
                range={range}
                raceTime={sync.raceTime}
                isPlaying={sync.isPlaying}
                playbackRate={sync.playbackRate}
              />
            </>
          )}
        </div>

        {hasCameras && (
          <aside className="h-144 min-h-0 lg:h-auto">
            <CamerasRunnersPanel
              shownSightings={shownSightings}
              totalCount={cameraSightings.length}
              unlinkedCameraCount={unlinkedCameraCount}
              errorMessage={sightingsByVideo.errorMessage}
              search={runnerSearch}
              onSearchChange={setRunnerSearch}
              raceTime={sync.raceTime}
              selectedKey={selectedSightingKey}
              onSelect={selectCameraSighting}
            />
          </aside>
        )}
      </main>

      <RaceClockDialog
        isOpen={clockDialog !== null}
        videoTime={clockDialog?.videoTime ?? 0}
        clockOffset={clockDialog?.clockOffset ?? null}
        onOpenChange={handleClockDialogOpenChange}
        onSave={handleClockDialogSave}
      />
    </div>
  );
};
