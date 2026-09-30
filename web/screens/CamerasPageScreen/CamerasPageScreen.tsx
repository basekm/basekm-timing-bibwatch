'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';

import {
  ArrowLeftIcon,
  ChevronDownIcon,
  VideoIcon
} from 'lucide-react';
import Image from 'next/image';
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
  MediaMutations,
  MediaQueries
} from '@basekm/api';
import {
  useLocalStorageState
} from '@basekm/hooks/use-local-storage-state';
import {
  RaceClockDialog
} from '@basekm/screens/ViewerPageScreen/components/RaceClockDialog';

import {
  CamerasTimeline
} from './components/CamerasTimeline';
import {
  CameraTile
} from './components/CameraTile';
import {
  useCameraSync
} from './hooks/useCameraSync';
import {
  CameraCoverage,
  CameraSyncController,
  coverageOf,
  SyncedCamera
} from './utils/CameraSyncController';

const SelectedCamerasStorageKey = 'bibwatch.cameras.selected';
const RaceTimeStorageKey = 'bibwatch.cameras.raceTime';
const DefaultCameraCount = 2;

type ClockDialogRequest = {
  name: string;
  videoTime: number;
  clockOffset: number | null;
};

const readStoredRaceTime = () => {
  try {
    const stored = Number(window.sessionStorage.getItem(RaceTimeStorageKey));
    return Number.isFinite(stored) && stored > 0 ? stored : null;
  } catch {
    return null;
  }
};

const writeStoredRaceTime = (raceTime: number) => {
  try {
    window.sessionStorage.setItem(RaceTimeStorageKey, String(raceTime));
  } catch {
    // Only a convenience: coming back from the viewer starts at the first recorded moment instead.
  }
};

const rangeOf = (cameras: SyncedCamera[]): CameraCoverage | null => {
  const coverages = cameras.map(coverageOf).filter((coverage): coverage is CameraCoverage => coverage !== null);
  if (!coverages.length) {
    return null;
  }

  return {
    from: Math.min(...coverages.map((coverage) => coverage.from)),
    to: Math.max(...coverages.map((coverage) => coverage.to)),
  };
};

const isTypingTarget = (target: EventTarget | null) => {
  const element = target as HTMLElement | null;
  return Boolean(element?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]'));
};

export const CamerasPageScreen = () => {
  const router = useRouter();
  const [controller] = useState(() => new CameraSyncController());
  const sync = useCameraSync(controller, 0.1);

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
  const [durations, setDurations] = useState<Record<string, number>>({});
  const [savedClocks, setSavedClocks] = useState<Record<string, number>>({});
  const [liningUp, setLiningUp] = useState<string[]>([]);
  const [clockDialog, setClockDialog] = useState<ClockDialogRequest | null>(null);

  const libraryVideos = useMemo(() => overview?.videos ?? [], [overview]);

  const clocks = useMemo(() => ({
    ...(overview?.clocks ?? {}),
    ...savedClocks,
  }), [overview, savedClocks]);

  const selectedNames = useMemo(() => {
    if (storedSelection) {
      return storedSelection.filter((name) => libraryVideos.includes(name));
    }

    const withClock = libraryVideos.filter((name) => clocks[name] !== undefined);
    return withClock.length >= DefaultCameraCount ? withClock : libraryVideos.slice(0, DefaultCameraCount);
  }, [clocks, libraryVideos, storedSelection]);

  // Keep the first pick, so linking a camera later doesn't swap the cameras shown.
  useEffect(() => {
    if (!storedSelection && overview && selectedNames.length) {
      setStoredSelection(selectedNames);
    }
  }, [overview, selectedNames, setStoredSelection, storedSelection]);

  const cameras: SyncedCamera[] = useMemo(() => selectedNames.map((name) => ({
    name,
    clockOffset: clocks[name] ?? null,
    duration: durations[name] ?? null,
  })), [clocks, durations, selectedNames]);

  // The race clock follows only cameras that are linked and not being lined up.
  const followingCameras = useMemo(
    () => cameras.filter((camera) => !liningUp.includes(camera.name)),
    [cameras, liningUp],
  );
  const range = useMemo(() => rangeOf(followingCameras), [followingCameras]);

  useEffect(() => {
    controller.setCameras(followingCameras);
  }, [controller, followingCameras]);

  useEffect(() => {
    cameras.forEach((camera) => controller.setDetached(camera.name, liningUp.includes(camera.name)));
  }, [cameras, controller, liningUp]);

  const hasPlacedClockRef = useRef(false);
  useEffect(() => {
    if (!range) {
      return;
    }

    const isOutside = controller.raceTime < range.from || controller.raceTime > range.to;
    if (!hasPlacedClockRef.current) {
      hasPlacedClockRef.current = true;
      controller.seekTo(readStoredRaceTime() ?? range.from);
    } else if (isOutside) {
      controller.seekTo(range.from);
    }
  }, [controller, range]);

  useEffect(() => () => controller.dispose(), [controller]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target) || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      const steps: Record<string, number> = {
        ArrowLeft: -5,
        ArrowRight: 5,
        ',': -0.1,
        '.': 0.1,
      };

      if (event.key === ' ') {
        event.preventDefault();
        controller.togglePlay();
      } else if (steps[event.key] !== undefined) {
        event.preventDefault();
        controller.step(steps[event.key]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [controller]);

  const setSelection = (names: string[]) => {
    setStoredSelection(libraryVideos.filter((name) => names.includes(name)));
  };

  const toggleCamera = (name: string, isShown: boolean) => {
    setSelection(isShown ? [...selectedNames, name] : selectedNames.filter((selected) => selected !== name));
  };

  const handleDuration = useCallback((name: string, duration: number) => {
    if (!Number.isFinite(duration)) {
      return;
    }
    setDurations((previous) => (previous[name] === duration ? previous : {
      ...previous,
      [name]: duration,
    }));
  }, []);

  const handleOpen = useCallback((name: string, videoTime: number) => {
    controller.pause();
    writeStoredRaceTime(controller.raceTime);
    const query = new URLSearchParams({
      camera: name,
      t: videoTime.toFixed(1),
    });
    router.push(`/?${query.toString()}`);
  }, [controller, router]);

  const stopLiningUp = (name: string) => {
    setLiningUp((previous) => previous.filter((lining) => lining !== name));
  };

  const saveClock = async (name: string, clockOffset: number) => {
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

  const hasOtherRaceClock = (name: string) => rangeOf(followingCameras.filter((camera) => camera.name !== name)) !== null;

  const isServerDown = mediaOverviewGetQuery.isError;
  const unlinkedCount = cameras.filter((camera) => camera.clockOffset === null).length;

  return (
    <div className="flex min-h-screen flex-col bg-muted/50">
      <header className="sticky top-0 z-10 flex h-14 w-full items-center justify-between gap-3 border-b border-border/50 bg-background/85 px-3 backdrop-blur-md sm:px-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <div className="flex shrink-0 items-center gap-2">
            <Image
              src="/logo.svg"
              alt=""
              width={22}
              height={22}
            />
            <span className="text-sm font-extrabold tracking-tight">bibwatch</span>
          </div>

          <div className="h-4 w-px shrink-0 bg-border" />

          <Button
            variant="ghost"
            size="sm"
            className="font-bold"
            render={<Link href="/" />}
            nativeButton={false}
          >
            <ArrowLeftIcon data-icon="inline-start" />
            Viewer
          </Button>

          <span className="truncate text-sm font-bold">All cameras</span>
        </div>

        {libraryVideos.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={(
                <Button
                  variant="outline"
                  size="sm"
                  className="font-bold"
                />
              )}
            >
              <VideoIcon data-icon="inline-start" />
              {selectedNames.length} of {libraryVideos.length} cameras
              <ChevronDownIcon data-icon="inline-end" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="max-h-96 w-80"
            >
              <DropdownMenuGroup>
                <DropdownMenuLabel>Videos to show together</DropdownMenuLabel>
                {libraryVideos.map((name) => (
                  <DropdownMenuCheckboxItem
                    key={name}
                    checked={selectedNames.includes(name)}
                    closeOnClick={false}
                    onCheckedChange={(isChecked) => toggleCamera(name, isChecked)}
                  >
                    <span className="truncate">{name}</span>
                    {clocks[name] === undefined && (
                      <span className="ml-auto text-xs text-muted-foreground">no race clock</span>
                    )}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>

      <main className="flex w-full flex-1 flex-col gap-4 p-3 sm:p-6">
        {isServerDown && (
          <Card className="p-6 text-sm text-muted-foreground">
            The bibwatch server isn’t reachable, so the videos in the media folder can’t be listed.
          </Card>
        )}

        {!isServerDown && overview && cameras.length === 0 && (
          <Card className="p-6 text-sm text-muted-foreground">
            Pick the videos to watch together from the cameras menu at the top right.
          </Card>
        )}

        {cameras.length > 0 && (
          <>
            {unlinkedCount > 0 && (
              <p className="text-sm text-muted-foreground">
                {range
                  ? 'Cameras without a race clock play on their own. Move one to the moment the others show and press “Match” to link it.'
                  : 'Set the race clock on one camera first. The others can then be matched to it.'}
              </p>
            )}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {cameras.map((camera) => (
                <CameraTile
                  key={camera.name}
                  camera={camera}
                  controller={controller}
                  raceTime={sync.raceTime}
                  hasRaceClock={hasOtherRaceClock(camera.name)}
                  isLiningUp={liningUp.includes(camera.name)}
                  onDuration={handleDuration}
                  onOpen={handleOpen}
                  onStartLineUp={(name) => {
                    controller.pause();
                    setLiningUp((previous) => [...previous, name]);
                  }}
                  onCancelLineUp={stopLiningUp}
                  onMatchRaceClock={(name, videoTime) => saveClock(name, controller.raceTime - videoTime)}
                  onSetClock={(name, videoTime) => {
                    controller.pause();
                    setClockDialog({
                      name,
                      videoTime,
                      clockOffset: clocks[name] ?? null,
                    });
                  }}
                  onRemove={(name) => toggleCamera(name, false)}
                />
              ))}
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
      </main>

      <RaceClockDialog
        isOpen={clockDialog !== null}
        videoTime={clockDialog?.videoTime ?? 0}
        clockOffset={clockDialog?.clockOffset ?? null}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setClockDialog(null);
          }
        }}
        onSave={(clockOffset) => {
          if (clockDialog) {
            saveClock(clockDialog.name, clockOffset);
          }
        }}
      />
    </div>
  );
};
