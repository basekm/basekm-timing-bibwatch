'use client';

import {
  PointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react';

import {
  MinusIcon,
  PlusIcon
} from 'lucide-react';

import {
  Button
} from '@/components/ui/button';
import {
  Card
} from '@/components/ui/card';
import {
  Slider
} from '@/components/ui/slider';
import {
  cn
} from '@/lib/utils';

import {
  SightingLabel
} from '@basekm/@shared/constants';
import {
  CameraSegmentKind
} from '@basekm/@shared/utils/cameraSegments';
import {
  sightingTime
} from '@basekm/@shared/utils/decideSightings';
import {
  formatVideoTime
} from '@basekm/@shared/utils/formatTime';
import {
  currentSightingLabel,
  sightingKey
} from '@basekm/@shared/utils/sightingTags';
import {
  CameraSegmentDto,
  SightingDto
} from '@basekm/dtos';

import {
  TimeRange
} from '../utils/unscannedRanges';
import {
  VideoPlaybackController
} from '../utils/VideoPlaybackController';

type RaceTimelineCardProps = {
  controller: VideoPlaybackController;
  duration: number;
  isPlaying: boolean;
  sightings: SightingDto[];
  segments: CameraSegmentDto[];
  unscannedRanges: TimeRange[];
  readingAt: number | null;
  selectedKey: string | null;
  onSelectSighting: (sighting: SightingDto) => void;
};

const TickSteps = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600];
const MinimumTickSpacingPx = 90;
const MinimumVisibleSeconds = 15;
const SliderSteps = 100;

const zoomFromSlider = (sliderValue: number, maxZoom: number) => Math.pow(maxZoom, sliderValue / SliderSteps);

const sliderFromZoom = (zoom: number, maxZoom: number) => (maxZoom <= 1 ? 0 : (Math.log(zoom) / Math.log(maxZoom)) * SliderSteps);

const markerClassNameOf = ({
  sighting,
  isSelected,
}: {
  sighting: SightingDto;
  isSelected: boolean;
}) => {
  const label = currentSightingLabel(sighting);
  const isMuted = label === SightingLabel.Duplicate || label === SightingLabel.NeedsScan;
  const colorClassName = (sighting.target && 'bg-red-500')
    || (label === SightingLabel.Crossed && 'bg-emerald-500')
    || (isMuted && 'bg-muted-foreground/40')
    || 'bg-blue-500/80';

  return cn(
    'absolute top-1/2 h-6 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform hover:scale-y-125',
    colorClassName,
    isSelected && 'ring-2 ring-foreground ring-offset-1 ring-offset-background',
  );
};

const segmentClassNameOf = (segment: CameraSegmentDto) => {
  if (segment.kind !== CameraSegmentKind.Fixed) {
    return 'bg-[repeating-linear-gradient(45deg,var(--muted)_0_6px,transparent_6px_12px)] text-muted-foreground';
  }

  if (segment.mat) {
    return 'bg-emerald-500/15 text-emerald-900';
  }

  return 'bg-blue-500/15 text-foreground';
};

const segmentLabelOf = (segment: CameraSegmentDto) => {
  if (segment.kind !== CameraSegmentKind.Fixed) {
    return 'Camera moving';
  }

  if (segment.mat) {
    return `Camera ${segment.index} · finish line`;
  }

  return `Camera ${segment.index}`;
};

export const RaceTimelineCard = ({
  controller,
  duration,
  isPlaying,
  sightings,
  segments,
  unscannedRanges,
  readingAt,
  selectedKey,
  onSelectSighting,
}: RaceTimelineCardProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const pendingScrollRef = useRef<number | null>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [zoom, setZoom] = useState(1);

  const maxZoom = Math.max(1, duration / MinimumVisibleSeconds);
  const contentWidth = Math.max(viewportWidth * zoom, 1);
  const pixelsPerSecond = duration ? contentWidth / duration : 0;

  const tickStep = TickSteps.find((step) => step * pixelsPerSecond >= MinimumTickSpacingPx) ?? TickSteps[TickSteps.length - 1];
  const ticks = useMemo(() => {
    if (!duration) {
      return [];
    }

    const count = Math.floor(duration / tickStep);
    return Array.from({
      length: count + 1,
    }, (_, index) => index * tickStep);
  }, [duration, tickStep]);

  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) {
      return;
    }

    const observer = new ResizeObserver(() => {
      setViewportWidth(scroller.clientWidth);
    });
    observer.observe(scroller);
    setViewportWidth(scroller.clientWidth);

    return () => {
      observer.disconnect();
    };
  }, []);

  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (scroller && pendingScrollRef.current !== null) {
      scroller.scrollLeft = pendingScrollRef.current;
      pendingScrollRef.current = null;
    }
  }, [zoom]);

  const zoomAround = useCallback((nextZoom: number, anchorPx: number) => {
    const scroller = scrollRef.current;
    if (!scroller || !duration) {
      return;
    }

    const clampedZoom = Math.min(Math.max(nextZoom, 1), maxZoom);
    const anchorTime = ((scroller.scrollLeft + anchorPx) / contentWidth) * duration;
    const nextPixelsPerSecond = (viewportWidth * clampedZoom) / duration;

    pendingScrollRef.current = Math.max(0, anchorTime * nextPixelsPerSecond - anchorPx);
    setZoom(clampedZoom);
  }, [contentWidth, duration, maxZoom, viewportWidth]);

  const zoomAroundPlayhead = useCallback((nextZoom: number) => {
    const scroller = scrollRef.current;
    if (!scroller) {
      return;
    }

    const playheadPx = controller.currentTime * pixelsPerSecond - scroller.scrollLeft;
    const isPlayheadVisible = playheadPx >= 0 && playheadPx <= viewportWidth;
    zoomAround(nextZoom, isPlayheadVisible ? playheadPx : viewportWidth / 2);
  }, [controller, pixelsPerSecond, viewportWidth, zoomAround]);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) {
      return;
    }

    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) {
        return;
      }

      event.preventDefault();
      const bounds = scroller.getBoundingClientRect();
      zoomAround(zoom * Math.exp(-event.deltaY * 0.01), event.clientX - bounds.left);
    };

    scroller.addEventListener('wheel', handleWheel, {
      passive: false,
    });

    return () => {
      scroller.removeEventListener('wheel', handleWheel);
    };
  }, [zoom, zoomAround]);

  useEffect(() => {
    let frameId = 0;

    const update = () => {
      const scroller = scrollRef.current;
      const playhead = playheadRef.current;
      const playheadPx = controller.currentTime * pixelsPerSecond;

      if (playhead) {
        playhead.style.transform = `translateX(${playheadPx}px)`;
      }

      const isOutOfView = scroller && (playheadPx < scroller.scrollLeft || playheadPx > scroller.scrollLeft + scroller.clientWidth - 24);
      if (scroller && isPlaying && isOutOfView && !controller.isScrubbing) {
        scroller.scrollLeft = Math.max(0, playheadPx - scroller.clientWidth * 0.1);
      }

      frameId = requestAnimationFrame(update);
    };

    frameId = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [controller, isPlaying, pixelsPerSecond]);

  const timeAtPointer = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return Math.min(Math.max((event.clientX - bounds.left) / pixelsPerSecond, 0), duration);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!duration || event.button !== 0) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    controller.startDrag(timeAtPointer(event));
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    controller.moveDrag(timeAtPointer(event));
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    controller.endDrag(timeAtPointer(event));
  };

  const handleMarkerPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  };

  const sliderValue = sliderFromZoom(zoom, maxZoom);

  return (
    <Card className="gap-0 py-0">
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-2.5">
        <h2 className="text-sm font-bold">Timeline</h2>

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-xs whitespace-nowrap text-muted-foreground sm:inline">Ctrl + scroll to zoom</span>

          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Zoom out"
            className="rounded-full"
            disabled={zoom <= 1}
            onClick={() => zoomAroundPlayhead(zoom / 1.5)}
          >
            <MinusIcon />
          </Button>

          <Slider
            className="w-28 sm:w-36"
            min={0}
            max={SliderSteps}
            value={[sliderValue]}
            disabled={maxZoom <= 1}
            onValueChange={(value) => zoomAroundPlayhead(zoomFromSlider(Array.isArray(value) ? value[0] : value, maxZoom))}
          />

          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Zoom in"
            className="rounded-full"
            disabled={zoom >= maxZoom}
            onClick={() => zoomAroundPlayhead(zoom * 1.5)}
          >
            <PlusIcon />
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={zoom === 1}
            onClick={() => setZoom(1)}
          >
            Fit all
          </Button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="overflow-x-auto overflow-y-hidden px-0 pb-1"
      >
        <div
          className="relative cursor-pointer touch-none select-none"
          style={{
            width: contentWidth,
          }}
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
                  left: tick * pixelsPerSecond,
                }}
              >
                <span className="absolute top-1.5 left-1.5 text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                  {formatVideoTime(tick)}
                </span>
              </div>
            ))}
          </div>

          <div className="relative h-16">
            {ticks.map((tick) => (
              <div
                key={tick}
                className="absolute inset-y-0 border-l border-border/60"
                style={{
                  left: tick * pixelsPerSecond,
                }}
              />
            ))}

            {unscannedRanges.map(([from, to]) => (
              <div
                key={`${from}-${to}`}
                title={`Not scanned yet: ${formatVideoTime(from)}–${formatVideoTime(to)}`}
                className="absolute inset-y-0 bg-[repeating-linear-gradient(45deg,var(--muted)_0_4px,transparent_4px_8px)]"
                style={{
                  left: from * pixelsPerSecond,
                  width: (to - from) * pixelsPerSecond,
                }}
              />
            ))}

            {readingAt !== null && (
              <div
                title={`Scanning here (${formatVideoTime(readingAt)})`}
                className="absolute inset-y-0 w-0.5 animate-pulse bg-primary"
                style={{
                  left: readingAt * pixelsPerSecond,
                }}
              />
            )}

            {sightings.map((sighting) => {
              const key = sightingKey(sighting);
              const time = sightingTime(sighting);

              return (
                <button
                  key={key}
                  type="button"
                  title={`${sighting.bib} · ${formatVideoTime(time, true)}`}
                  className={markerClassNameOf({
                    sighting,
                    isSelected: key === selectedKey,
                  })}
                  style={{
                    left: time * pixelsPerSecond,
                  }}
                  onPointerDown={handleMarkerPointerDown}
                  onClick={() => onSelectSighting(sighting)}
                />
              );
            })}
          </div>

          <div className="relative h-7 border-t">
            {segments.map((segment) => (
              <div
                key={`${segment.index}-${segment.from}`}
                title={`${segmentLabelOf(segment)} · ${formatVideoTime(segment.from)}–${formatVideoTime(segment.to)}`}
                className={cn('absolute inset-y-0.5 overflow-hidden rounded-sm border-l-2 border-background px-2 py-1 text-xs font-semibold whitespace-nowrap italic', segmentClassNameOf(segment))}
                style={{
                  left: segment.from * pixelsPerSecond,
                  width: (segment.to - segment.from) * pixelsPerSecond,
                }}
              >
                {segmentLabelOf(segment)}
              </div>
            ))}
          </div>

          <div
            ref={playheadRef}
            className="pointer-events-none absolute inset-y-0 left-0 w-0.5 bg-red-500 will-change-transform"
          >
            <div className="absolute -top-0.5 -left-1 size-2.5 rounded-full bg-red-500" />
          </div>
        </div>
      </div>
    </Card>
  );
};
