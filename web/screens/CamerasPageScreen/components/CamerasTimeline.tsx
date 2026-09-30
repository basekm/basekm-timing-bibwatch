'use client';

import {
  PointerEvent,
  useEffect,
  useRef,
  useState
} from 'react';

import {
  PauseIcon,
  PlayIcon,
  RotateCcwIcon,
  RotateCwIcon,
  StepBackIcon,
  StepForwardIcon
} from 'lucide-react';

import {
  Button
} from '@/components/ui/button';
import {
  Card
} from '@/components/ui/card';
import {
  cn
} from '@/lib/utils';

import {
  formatClockTime
} from '@basekm/@shared/utils/formatTime';

import {
  CameraCoverage,
  CameraSyncController,
  coverageOf,
  SyncedCamera
} from '../utils/CameraSyncController';

type CamerasTimelineProps = {
  controller: CameraSyncController;
  cameras: SyncedCamera[];
  range: CameraCoverage | null;
  raceTime: number;
  isPlaying: boolean;
  playbackRate: number;
};

type HoverTip = {
  left: number;
  text: string;
};

const PlaybackRates = [0.5, 1, 2, 4];
const LaneLabelWidth = '7rem';

export const CamerasTimeline = ({
  controller,
  cameras,
  range,
  raceTime,
  isPlaying,
  playbackRate,
}: CamerasTimelineProps) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const [hoverTip, setHoverTip] = useState<HoverTip | null>(null);
  const isDraggingRef = useRef(false);
  const wasPlayingRef = useRef(false);

  const span = range ? Math.max(range.to - range.from, 1) : 1;
  const percentOf = (time: number) => (range ? ((time - range.from) / span) * 100 : 0);

  useEffect(() => {
    let frameId = 0;

    const update = () => {
      if (playheadRef.current && range) {
        const fraction = Math.min(Math.max((controller.raceTime - range.from) / span, 0), 1);
        playheadRef.current.style.left = `${fraction * 100}%`;
      }
      frameId = requestAnimationFrame(update);
    };

    frameId = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [controller, range, span]);

  const timeAtPointer = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const fraction = Math.min(Math.max((event.clientX - bounds.left) / bounds.width, 0), 1);
    return (range?.from ?? 0) + fraction * span;
  };

  const showHoverTip = (event: PointerEvent<HTMLDivElement>, time: number) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    setHoverTip({
      left: Math.min(Math.max(event.clientX - bounds.left, 40), bounds.width - 40),
      text: formatClockTime(time),
    });
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!range) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    isDraggingRef.current = true;
    wasPlayingRef.current = controller.isPlaying;
    if (controller.isPlaying) {
      controller.pause();
    }

    const time = timeAtPointer(event);
    showHoverTip(event, time);
    controller.seekTo(time);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!range) {
      return;
    }

    const time = timeAtPointer(event);
    showHoverTip(event, time);
    if (isDraggingRef.current) {
      controller.seekTo(time);
    }
  };

  const handlePointerUp = () => {
    if (!isDraggingRef.current) {
      return;
    }

    isDraggingRef.current = false;
    if (wasPlayingRef.current) {
      controller.play();
    }
  };

  const hasRange = range !== null;

  return (
    <Card className="gap-3 p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="icon"
          className="rounded-full"
          disabled={!hasRange}
          aria-label={isPlaying ? 'Pause every camera' : 'Play every camera'}
          onClick={() => controller.togglePlay()}
        >
          {isPlaying ? <PauseIcon className="fill-current" /> : <PlayIcon className="fill-current" />}
        </Button>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            disabled={!hasRange}
            aria-label="Back 5 seconds"
            title="Back 5 seconds (←)"
            onClick={() => controller.step(-5)}
          >
            <RotateCcwIcon />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={!hasRange}
            aria-label="Back a tenth of a second"
            title="Back 0.1 s (,)"
            onClick={() => controller.step(-0.1)}
          >
            <StepBackIcon />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={!hasRange}
            aria-label="Forward a tenth of a second"
            title="Forward 0.1 s (.)"
            onClick={() => controller.step(0.1)}
          >
            <StepForwardIcon />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={!hasRange}
            aria-label="Forward 5 seconds"
            title="Forward 5 seconds (→)"
            onClick={() => controller.step(5)}
          >
            <RotateCwIcon />
          </Button>
        </div>

        <div className="flex items-center rounded-md border p-0.5">
          {PlaybackRates.map((rate) => (
            <button
              key={rate}
              type="button"
              className={cn(
                'rounded px-2 py-1 text-xs font-bold tabular-nums text-muted-foreground hover:text-foreground',
                playbackRate === rate && 'bg-muted text-foreground',
              )}
              onClick={() => controller.setPlaybackRate(rate)}
            >
              {rate}×
            </button>
          ))}
        </div>

        <div className="ml-auto text-right">
          <div className="text-xs font-semibold text-muted-foreground">Race clock</div>
          <div className="text-xl font-extrabold tabular-nums">{hasRange ? formatClockTime(raceTime) : '—'}</div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        {cameras.map((camera) => {
          const coverage = coverageOf(camera);

          return (
            <div
              key={camera.name}
              className="grid items-center gap-2"
              style={{
                gridTemplateColumns: `${LaneLabelWidth} minmax(0, 1fr)`,
              }}
            >
              <span
                title={camera.name}
                className="truncate text-xs font-semibold text-muted-foreground"
              >
                {camera.name}
              </span>
              <div className="relative h-4 rounded bg-muted">
                {coverage && range && (
                  <div
                    className="absolute inset-y-0.5 rounded-sm bg-sky-500/70"
                    style={{
                      left: `${percentOf(coverage.from)}%`,
                      width: `${Math.max(percentOf(coverage.to) - percentOf(coverage.from), 0.5)}%`,
                    }}
                  />
                )}
                {!coverage && (
                  <span className="absolute inset-0 flex items-center px-2 text-[11px] text-muted-foreground">
                    {camera.clockOffset === null ? 'Not linked yet' : 'Loading…'}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div
        className="grid items-center gap-2"
        style={{
          gridTemplateColumns: `${LaneLabelWidth} minmax(0, 1fr)`,
        }}
      >
        <span className="text-xs font-semibold text-muted-foreground">Scrub all</span>
        <div
          ref={trackRef}
          className={cn('relative h-6 touch-none', hasRange ? 'cursor-pointer' : 'opacity-50')}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={() => {
            if (!isDraggingRef.current) {
              setHoverTip(null);
            }
          }}
        >
          <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-muted" />
          {hasRange && (
            <div
              ref={playheadRef}
              className="pointer-events-none absolute top-1/2 -mt-2 -ml-2 size-4 rounded-full border-2 border-white bg-red-500 shadow-sm"
            />
          )}
          {hoverTip && (
            <div
              className="pointer-events-none absolute bottom-7 -translate-x-1/2 rounded-md bg-neutral-950/90 px-2 py-1 text-xs font-semibold whitespace-nowrap text-white tabular-nums"
              style={{
                left: hoverTip.left,
              }}
            >
              {hoverTip.text}
            </div>
          )}
        </div>
      </div>

      {range && (
        <div
          className="grid gap-2 text-xs text-muted-foreground tabular-nums"
          style={{
            gridTemplateColumns: `${LaneLabelWidth} minmax(0, 1fr)`,
          }}
        >
          <span />
          <div className="flex justify-between">
            <span>{formatClockTime(range.from, false)}</span>
            <span>{formatClockTime(range.to, false)}</span>
          </div>
        </div>
      )}
    </Card>
  );
};
