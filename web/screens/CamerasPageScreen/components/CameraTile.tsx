'use client';

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState
} from 'react';

import {
  ExternalLinkIcon,
  Link2Icon,
  Link2OffIcon,
  PauseIcon,
  PlayIcon,
  RotateCcwIcon,
  RotateCwIcon,
  StepBackIcon,
  StepForwardIcon,
  TimerIcon,
  XIcon
} from 'lucide-react';

import {
  Button
} from '@/components/ui/button';
import {
  cn
} from '@/lib/utils';

import {
  formatClockTime,
  formatVideoTime
} from '@basekm/@shared/utils/formatTime';
import {
  MediaScanFilesDto
} from '@basekm/dtos';
import {
  useVideoElementState
} from '@basekm/hooks/use-video-element-state';
import {
  PlayerScrubber
} from '@basekm/screens/ViewerPageScreen/components/PlayerScrubber';
import {
  VideoOverlayCanvas
} from '@basekm/screens/ViewerPageScreen/components/VideoOverlayCanvas';
import {
  useVideoTime
} from '@basekm/screens/ViewerPageScreen/hooks/useVideoTime';
import {
  OverlayScene
} from '@basekm/screens/ViewerPageScreen/utils/drawVideoOverlay';
import {
  VideoPlaybackController
} from '@basekm/screens/ViewerPageScreen/utils/VideoPlaybackController';

import {
  useCameraOverlayScene
} from '../hooks/useCameraOverlayScene';
import {
  CameraSyncController,
  coverageOf,
  SyncedCamera,
  videoTimeAt
} from '../utils/CameraSyncController';

export type CameraMoment = {
  name: string;
  videoTime: number;
};

type CameraTileProps = {
  camera: SyncedCamera;
  controller: CameraSyncController;
  raceTime: number;
  hasRaceClock: boolean;
  isLiningUp: boolean;
  scanFiles: MediaScanFilesDto | null;
  isBoxesShown: boolean;
  onDuration: (cameraDuration: { name: string; duration: number }) => void;
  onOpen: (moment: CameraMoment) => void;
  onStartLineUp: (name: string) => void;
  onCancelLineUp: (name: string) => void;
  onMatchRaceClock: (moment: CameraMoment) => void;
  onSetClock: (moment: CameraMoment) => void;
  onRemove: (name: string) => void;
};

const EmptyOverlayScene: OverlayScene = {
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
};

const isNeverClickable = () => false;

const ControlButtonClassName = 'inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-bold text-white transition-colors hover:bg-white/15 disabled:opacity-40 [&_svg]:size-4';
const BadgeClassName = 'flex items-center gap-1.5 rounded-md bg-neutral-950/80 px-2.5 py-1.5 text-xs font-bold text-white';

const TileTimeDisplay = ({
  playback,
  duration,
}: {
  playback: VideoPlaybackController;
  duration: number;
}) => {
  const time = useVideoTime(playback, 0.1);

  return (
    <span className="px-1 text-xs font-semibold text-white tabular-nums">
      {formatVideoTime(time, true)} / {formatVideoTime(duration)}
    </span>
  );
};

export const CameraTile = ({
  camera,
  controller,
  raceTime,
  hasRaceClock,
  isLiningUp,
  scanFiles,
  isBoxesShown,
  onDuration,
  onOpen,
  onStartLineUp,
  onCancelLineUp,
  onMatchRaceClock,
  onSetClock,
  onRemove,
}: CameraTileProps) => {
  const [playback] = useState(() => new VideoPlaybackController());
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const videoState = useVideoElementState(video);
  const scene = useCameraOverlayScene({
    scanFiles,
    clockOffset: camera.clockOffset,
  });
  const sceneRef = useRef<OverlayScene>(EmptyOverlayScene);

  useLayoutEffect(() => {
    sceneRef.current = scene ?? EmptyOverlayScene;
  });

  const isLinked = camera.clockOffset !== null;
  const isFollowing = isLinked && !isLiningUp;
  const coverage = coverageOf(camera);
  const recordingAt = videoTimeAt({
    camera,
    raceTime,
  });
  const duration = videoState.duration || camera.duration || 0;

  const handleVideoRef = useCallback((element: HTMLVideoElement | null) => {
    playback.attach(element);
    controller.attachVideo({
      name: camera.name,
      video: element,
    });
    setVideo(element);
  }, [camera.name, controller, playback]);

  const stepOnItsOwn = (deltaSeconds: number) => {
    playback.pause();
    playback.step(deltaSeconds);
  };

  const currentMoment = () => ({
    name: camera.name,
    videoTime: playback.currentTime,
  });

  const isNotRecording = isFollowing && coverage !== null && recordingAt === null;
  const hasNotStarted = coverage !== null && raceTime < coverage.from;
  const startsAtText = coverage && `Starts at ${formatClockTime(coverage.from, false)}`;
  const endedAtText = coverage && `Ended at ${formatClockTime(coverage.to, false)}`;
  const notRecordingText = (hasNotStarted && startsAtText) || endedAtText;
  const lineUpHintText = (hasRaceClock && 'Move to the moment the other cameras show') || 'Pause on a moment you know the race time of';
  const matchLabelText = `Match ${formatClockTime(raceTime)}`;
  const setClockVariant = (hasRaceClock && 'outline') || 'default';

  return (
    <div
      className={cn(
        'group/player relative aspect-video w-full min-w-0 overflow-hidden rounded-xl bg-neutral-900 shadow-sm lg:aspect-auto lg:h-full lg:min-h-0',
        isLiningUp && 'ring-2 ring-sky-400',
      )}
    >
      <video
        ref={handleVideoRef}
        src={`/media/${encodeURIComponent(camera.name)}`}
        className="absolute inset-0 size-full object-contain"
        preload="auto"
        muted
        playsInline
        onLoadedMetadata={(event) => onDuration({
          name: camera.name,
          duration: event.currentTarget.duration,
        })}
      />

      {scene && (
        <VideoOverlayCanvas
          controller={playback}
          sceneRef={sceneRef}
          isOverlayShown={isBoxesShown}
          isPicking={false}
          onFrameClick={() => playback.togglePlay()}
          isClickableAt={isNeverClickable}
        />
      )}

      {isFollowing && (
        <button
          type="button"
          aria-label={`Open ${camera.name} in the viewer at this moment`}
          title="Open in the viewer at this moment"
          className="absolute inset-0 cursor-pointer"
          onClick={() => onOpen(currentMoment())}
        />
      )}

      {isNotRecording && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-neutral-950/70">
          <span className="text-sm font-bold text-white/80">{notRecordingText}</span>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2 *:pointer-events-auto">
        <span
          title={camera.name}
          className={cn(BadgeClassName, 'min-w-0')}
        >
          <span className="truncate">{camera.name}</span>
        </span>

        <div className="flex shrink-0 items-center gap-1.5">
          {isFollowing && (
            <span className={cn(BadgeClassName, 'text-emerald-300')}>
              <Link2Icon className="size-3.5" />
                Linked
            </span>
          )}
          {isLiningUp && (
            <span className={cn(BadgeClassName, 'text-sky-300')}>Lining up</span>
          )}
          {!isLinked && (
            <span className={cn(BadgeClassName, 'text-white/70')}>
              <Link2OffIcon className="size-3.5" />
              <span className="hidden sm:inline">Race clock not set</span>
            </span>
          )}

          <div className="flex items-center rounded-md bg-neutral-950/80">
            <button
              type="button"
              aria-label={`Open ${camera.name} in the viewer`}
              title="Open in the viewer"
              className={ControlButtonClassName}
              onClick={() => onOpen(currentMoment())}
            >
              <ExternalLinkIcon className="size-3.5!" />
            </button>
            <button
              type="button"
              aria-label={`Remove ${camera.name} from this view`}
              title="Remove from this view"
              className={ControlButtonClassName}
              onClick={() => onRemove(camera.name)}
            >
              <XIcon className="size-3.5!" />
            </button>
          </div>
        </div>
      </div>

      <div
        className={cn(
          'pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-linear-to-t from-neutral-950/85 via-neutral-950/50 to-transparent px-3 pt-10 pb-2 *:pointer-events-auto',
          isFollowing && 'opacity-0 transition-opacity duration-200 group-hover/player:opacity-100 has-focus-visible:opacity-100 pointer-coarse:opacity-100',
        )}
      >
        {!isFollowing && (
          <PlayerScrubber
            controller={playback}
            clockOffset={null}
          />
        )}

        <div className="flex items-center gap-1">
          {!isFollowing && (
            <>
              <button
                type="button"
                aria-label={videoState.isPlaying ? 'Pause' : 'Play'}
                className={ControlButtonClassName}
                onClick={() => playback.togglePlay()}
              >
                {videoState.isPlaying ? <PauseIcon className="fill-current" /> : <PlayIcon className="fill-current" />}
              </button>
              <button
                type="button"
                title="Back 1 s"
                className={ControlButtonClassName}
                onClick={() => stepOnItsOwn(-1)}
              >
                <RotateCcwIcon className="size-3.5!" />
                  1s
              </button>
              <button
                type="button"
                title="Forward 1 s"
                className={ControlButtonClassName}
                onClick={() => stepOnItsOwn(1)}
              >
                  1s
                <RotateCwIcon className="size-3.5!" />
              </button>
              <button
                type="button"
                aria-label="Back 0.1 s"
                title="Back 0.1 s"
                className={ControlButtonClassName}
                onClick={() => stepOnItsOwn(-0.1)}
              >
                <StepBackIcon />
              </button>
              <button
                type="button"
                aria-label="Forward 0.1 s"
                title="Forward 0.1 s"
                className={ControlButtonClassName}
                onClick={() => stepOnItsOwn(0.1)}
              >
                <StepForwardIcon />
              </button>
            </>
          )}

          <TileTimeDisplay
            playback={playback}
            duration={duration}
          />

          <div className="flex-1" />

          {isFollowing && (
            <button
              type="button"
              title="Move this camera on its own to line it up again"
              className={ControlButtonClassName}
              onClick={() => onStartLineUp(camera.name)}
            >
                Line up
            </button>
          )}
        </div>

        {!isFollowing && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="min-w-0 flex-1 px-1 text-xs font-semibold text-white/70">
              {lineUpHintText}
            </span>

            {isLiningUp && (
              <button
                type="button"
                className={ControlButtonClassName}
                onClick={() => onCancelLineUp(camera.name)}
              >
                  Cancel
              </button>
            )}
            <Button
              variant={setClockVariant}
              size="sm"
              className={cn('font-bold', hasRaceClock && 'border-white/30 bg-transparent text-white hover:bg-white/15 hover:text-white')}
              onClick={() => onSetClock(currentMoment())}
            >
              <TimerIcon data-icon="inline-start" />
                Set race clock…
            </Button>
            {hasRaceClock && (
              <Button
                size="sm"
                className="font-bold"
                onClick={() => onMatchRaceClock(currentMoment())}
              >
                <Link2Icon data-icon="inline-start" />
                {matchLabelText}
              </Button>
            )}
          </div>
        )}
      </div>

    </div>
  );
};
