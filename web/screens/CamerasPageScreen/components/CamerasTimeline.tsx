'use client';

import {
  PointerEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react';

import {
  ChevronDownIcon,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  cn
} from '@/lib/utils';

import {
  PlaybackRates
} from '@basekm/@shared/constants';
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

const TickSteps = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600];
const MinimumTickSpacingPx = 90;

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
  const isDraggingRef = useRef(false);
  const wasPlayingRef = useRef(false);
  const [trackWidth, setTrackWidth] = useState(0);

  const span = range ? Math.max(range.to - range.from, 1) : 1;
  const percentOf = (time: number) => (range ? ((time - range.from) / span) * 100 : 0);

  const ticks = useMemo(() => {
    if (!range || !trackWidth) {
      return [];
    }

    const pixelsPerSecond = trackWidth / span;
    const step = TickSteps.find((candidate) => candidate * pixelsPerSecond >= MinimumTickSpacingPx) ?? TickSteps[TickSteps.length - 1];
    const first = Math.ceil(range.from / step) * step;
    const count = Math.max(0, Math.floor((range.to - first) / step) + 1);

    return Array.from({
      length: count,
    }, (_, index) => first + index * step);
  }, [range, span, trackWidth]);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) {
      return;
    }

    const observer = new ResizeObserver(() => {
      setTrackWidth(track.clientWidth);
    });
    observer.observe(track);
    setTrackWidth(track.clientWidth);

    return () => {
      observer.disconnect();
    };
  }, []);

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

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!range || event.button !== 0) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    isDraggingRef.current = true;
    wasPlayingRef.current = controller.isPlaying;
    if (controller.isPlaying) {
      controller.pause();
    }
    controller.seekTo(timeAtPointer(event));
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (isDraggingRef.current) {
      controller.seekTo(timeAtPointer(event));
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
    <Card className="gap-0 py-0">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
        <h2 className="mr-1 text-sm font-bold">Timeline</h2>

        <Button
          variant="outline"
          size="icon-sm"
          disabled={!hasRange}
          aria-label={isPlaying ? 'Pause every camera' : 'Play every camera'}
          title="Space"
          onClick={() => controller.togglePlay()}
        >
          {isPlaying ? <PauseIcon className="fill-current" /> : <PlayIcon className="fill-current" />}
        </Button>

        <Button
          variant="outline"
          size="sm"
          disabled={!hasRange}
          title="Back 5 s (←)"
          onClick={() => controller.step(-5)}
        >
          <RotateCcwIcon data-icon="inline-start" />
          5s
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!hasRange}
          title="Forward 5 s (→)"
          onClick={() => controller.step(5)}
        >
          5s
          <RotateCwIcon data-icon="inline-end" />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          disabled={!hasRange}
          aria-label="Back 0.1 s"
          title="Back 0.1 s (,)"
          onClick={() => controller.step(-0.1)}
        >
          <StepBackIcon />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          disabled={!hasRange}
          aria-label="Forward 0.1 s"
          title="Forward 0.1 s (.)"
          onClick={() => controller.step(0.1)}
        >
          <StepForwardIcon />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={(
              <Button
                variant="outline"
                size="sm"
                className="tabular-nums"
              />
            )}
          >
            {playbackRate}×
            <ChevronDownIcon data-icon="inline-end" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-40">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Playback speed</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={playbackRate}
                onValueChange={(rate: number) => controller.setPlaybackRate(rate)}
              >
                {PlaybackRates.map((rate) => (
                  <DropdownMenuRadioItem
                    key={rate}
                    value={rate}
                    className="tabular-nums"
                  >
                    {rate}×
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="ml-auto flex items-baseline gap-2">
          <span className="text-xs font-semibold text-muted-foreground">Race clock</span>
          <span className="text-sm font-extrabold tabular-nums">{hasRange ? formatClockTime(raceTime) : '—'}</span>
        </div>
      </div>

      <div
        ref={trackRef}
        className={cn('relative touch-none select-none', hasRange && 'cursor-pointer')}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div className="relative h-7 border-b bg-muted/40">
          {ticks.map((tick) => (
            <div
              key={tick}
              className="absolute inset-y-0 border-l border-border"
              style={{
                left: `${percentOf(tick)}%`,
              }}
            >
              <span className="absolute top-1.5 left-1.5 text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                {formatClockTime(tick, false)}
              </span>
            </div>
          ))}
          {!hasRange && (
            <span className="absolute inset-0 flex items-center px-3 text-xs text-muted-foreground">
              Set the race clock on a camera to see the race here
            </span>
          )}
        </div>

        <div className="relative flex flex-col gap-1 py-1.5">
          {ticks.map((tick) => (
            <div
              key={tick}
              className="absolute inset-y-0 border-l border-border/60"
              style={{
                left: `${percentOf(tick)}%`,
              }}
            />
          ))}

          {cameras.map((camera) => {
            const coverage = coverageOf(camera);
            const coverageText = coverage && `${camera.name} · ${formatClockTime(coverage.from, false)}–${formatClockTime(coverage.to, false)}`;
            const missingClockText = `${camera.name} · race clock not set`;
            const loadingText = `${camera.name} · loading…`;
            const isMissingClock = camera.clockOffset === null;
            const label = coverageText || (isMissingClock && missingClockText) || loadingText;

            return (
              <div
                key={camera.name}
                className="relative h-6"
              >
                {coverage && range && (
                  <div
                    title={label}
                    className="absolute inset-y-0 overflow-hidden rounded-sm border-l-2 border-background bg-blue-500/15 px-2 py-1 text-xs font-semibold whitespace-nowrap text-foreground italic"
                    style={{
                      left: `${percentOf(coverage.from)}%`,
                      width: `${Math.max(percentOf(coverage.to) - percentOf(coverage.from), 0.5)}%`,
                    }}
                  >
                    {camera.name}
                  </div>
                )}
                {!coverage && (
                  <div
                    title={label}
                    className="absolute inset-0 overflow-hidden rounded-sm bg-[repeating-linear-gradient(45deg,var(--muted)_0_6px,transparent_6px_12px)] px-2 py-1 text-xs font-semibold whitespace-nowrap text-muted-foreground italic"
                  >
                    {label}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {hasRange && (
          <div
            ref={playheadRef}
            className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-red-500"
          >
            <div className="absolute -top-0.5 -left-1 size-2.5 rounded-full bg-red-500" />
          </div>
        )}
      </div>
    </Card>
  );
};
