'use client';

import {
  useCallback,
  useEffect,
  useState
} from 'react';

import {
  ExternalLinkIcon,
  Link2Icon,
  Link2OffIcon,
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
  CameraSyncController,
  coverageOf,
  SyncedCamera,
  videoTimeAt
} from '../utils/CameraSyncController';

type CameraTileProps = {
  camera: SyncedCamera;
  controller: CameraSyncController;
  raceTime: number;
  hasRaceClock: boolean;
  isLiningUp: boolean;
  onDuration: (name: string, duration: number) => void;
  onOpen: (name: string, videoTime: number) => void;
  onStartLineUp: (name: string) => void;
  onCancelLineUp: (name: string) => void;
  onMatchRaceClock: (name: string, videoTime: number) => void;
  onSetClock: (name: string, videoTime: number) => void;
  onRemove: (name: string) => void;
};

const NudgeSteps = [-1, -0.1, 0.1, 1];

const useVideoCurrentTime = (video: HTMLVideoElement | null) => {
  const [time, setTime] = useState(0);

  useEffect(() => {
    if (!video) {
      return;
    }

    const update = () => setTime(video.currentTime);
    const events = ['timeupdate', 'seeked', 'loadedmetadata'];
    events.forEach((eventName) => video.addEventListener(eventName, update));
    update();

    return () => {
      events.forEach((eventName) => video.removeEventListener(eventName, update));
    };
  }, [video]);

  return time;
};

export const CameraTile = ({
  camera,
  controller,
  raceTime,
  hasRaceClock,
  isLiningUp,
  onDuration,
  onOpen,
  onStartLineUp,
  onCancelLineUp,
  onMatchRaceClock,
  onSetClock,
  onRemove,
}: CameraTileProps) => {
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const videoTime = useVideoCurrentTime(video);

  const isLinked = camera.clockOffset !== null;
  const isFollowing = isLinked && !isLiningUp;
  const coverage = coverageOf(camera);
  const recordingAt = videoTimeAt(camera, raceTime);

  const handleVideoRef = useCallback((element: HTMLVideoElement | null) => {
    controller.attachVideo(camera.name, element);
    setVideo(element);
  }, [camera.name, controller]);

  let notRecordingText: string | null = null;
  if (isFollowing && coverage && recordingAt === null) {
    notRecordingText = raceTime < coverage.from
      ? `Starts at ${formatClockTime(coverage.from, false)}`
      : `Ended at ${formatClockTime(coverage.to, false)}`;
  }

  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-2 rounded-xl border bg-card p-2 shadow-xs',
        isLiningUp && 'border-sky-400 ring-2 ring-sky-400/30',
      )}
    >
      <div className="flex min-w-0 items-center gap-2 px-1">
        <span
          title={camera.name}
          className="min-w-0 flex-1 truncate text-sm font-bold"
        >
          {camera.name}
        </span>

        {isFollowing && (
          <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-emerald-600">
            <Link2Icon className="size-3.5" />
            Linked
          </span>
        )}
        {!isLinked && (
          <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-muted-foreground">
            <Link2OffIcon className="size-3.5" />
            Race clock not set
          </span>
        )}
        {isLiningUp && (
          <span className="shrink-0 text-xs font-semibold text-sky-600">Lining up</span>
        )}

        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={`Open ${camera.name} in the viewer`}
          title="Open in the viewer"
          onClick={() => onOpen(camera.name, videoTime)}
        >
          <ExternalLinkIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={`Remove ${camera.name} from this view`}
          title="Remove from this view"
          onClick={() => onRemove(camera.name)}
        >
          <XIcon />
        </Button>
      </div>

      <div className="group/tile relative aspect-video w-full overflow-hidden rounded-lg bg-neutral-900">
        <video
          ref={handleVideoRef}
          src={`/media/${encodeURIComponent(camera.name)}`}
          className="absolute inset-0 size-full object-contain"
          preload="auto"
          muted
          playsInline
          controls={!isFollowing}
          onLoadedMetadata={(event) => onDuration(camera.name, event.currentTarget.duration)}
        />

        {isFollowing && (
          <button
            type="button"
            aria-label={`Open ${camera.name} in the viewer at this moment`}
            className="absolute inset-0 flex cursor-pointer items-center justify-center opacity-0 transition-opacity group-hover/tile:opacity-100 focus-visible:opacity-100"
            onClick={() => onOpen(camera.name, videoTime)}
          >
            <span className="flex items-center gap-1.5 rounded-md bg-neutral-950/80 px-2.5 py-1.5 text-xs font-bold text-white">
              <ExternalLinkIcon className="size-3.5" />
              Open in viewer
            </span>
          </button>
        )}

        {notRecordingText && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-neutral-950/70">
            <span className="text-sm font-bold text-white/80">{notRecordingText}</span>
          </div>
        )}

        {isFollowing && recordingAt !== null && (
          <span className="pointer-events-none absolute top-2 left-2 rounded-md bg-neutral-950/80 px-2 py-1 text-xs font-bold text-white tabular-nums">
            {formatVideoTime(videoTime, true)}
          </span>
        )}
      </div>

      {isFollowing && (
        <div className="flex items-center justify-between gap-2 px-1">
          <span className="text-xs text-muted-foreground tabular-nums">
            {coverage
              ? `${formatClockTime(coverage.from, false)} – ${formatClockTime(coverage.to, false)}`
              : 'Loading…'}
          </span>
          <Button
            variant="outline"
            size="xs"
            onClick={() => onStartLineUp(camera.name)}
          >
            Line up
          </Button>
        </div>
      )}

      {!isFollowing && (
        <div className="flex flex-col gap-2 px-1 pb-1">
          <p className="text-xs text-muted-foreground">
            {hasRaceClock
              ? 'Move this video to the same moment the other cameras show, then match it.'
              : 'Pause on a moment you know the race time of, like a runner’s chip read, and set the race clock.'}
          </p>

          <div className="flex flex-wrap items-center gap-1">
            {NudgeSteps.map((step) => (
              <Button
                key={step}
                variant="outline"
                size="xs"
                className="tabular-nums"
                onClick={() => controller.nudge(camera.name, step)}
              >
                {step > 0 ? '+' : '−'}{Math.abs(step)}s
              </Button>
            ))}
            <span className="ml-auto text-xs font-semibold text-muted-foreground tabular-nums">
              {formatVideoTime(videoTime, true)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {hasRaceClock && (
              <Button
                size="xs"
                onClick={() => onMatchRaceClock(camera.name, videoTime)}
              >
                <Link2Icon data-icon="inline-start" />
                Match {formatClockTime(raceTime)}
              </Button>
            )}
            <Button
              variant={hasRaceClock ? 'outline' : 'default'}
              size="xs"
              onClick={() => onSetClock(camera.name, videoTime)}
            >
              <TimerIcon data-icon="inline-start" />
              Set race clock…
            </Button>
            {isLiningUp && (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => onCancelLineUp(camera.name)}
              >
                Cancel
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
