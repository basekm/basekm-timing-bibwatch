'use client';

import {
  RefObject,
  useEffect,
  useRef,
  useState
} from 'react';

import {
  createLucideIcon,
  PauseIcon,
  PlayIcon,
  RectangleHorizontalIcon,
  RotateCcwIcon,
  RotateCwIcon,
  SettingsIcon,
  SquareDashedIcon
} from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Kbd
} from '@/components/ui/kbd';
import {
  cn
} from '@/lib/utils';

import {
  PlaybackRates
} from '@basekm/@shared/constants';
import {
  formatVideoTime
} from '@basekm/@shared/utils/formatTime';

import {
  useVideoTime
} from '../hooks/useVideoTime';
import {
  FramePoint
} from '../hooks/useViewerSession';
import {
  OverlayScene
} from '../utils/drawVideoOverlay';
import {
  VideoPlaybackController
} from '../utils/VideoPlaybackController';

import {
  PlayerScrubber
} from './PlayerScrubber';
import {
  RaceClockBadge
} from './RaceClockBadge';
import {
  VideoOverlayCanvas
} from './VideoOverlayCanvas';

type VideoPlayerCardProps = {
  controller: VideoPlaybackController;
  sceneRef: RefObject<OverlayScene>;
  videoSrc: string;
  onVideoElement: (video: HTMLVideoElement | null) => void;
  isPlaying: boolean;
  duration: number;
  playbackRate: number;
  clockOffset: number | null;
  isOverlayShown: boolean;
  isPicking: boolean;
  isWide: boolean;
  isMarkingFinishLine: boolean;
  onToggleOverlay: () => void;
  onToggleWide: () => void;
  onToggleFinishLineMarking: () => void;
  onCameraMoved: () => void;
  onSetClock: () => void;
  onFrameClick: (point: FramePoint | null) => void;
  isClickableAt: (point: FramePoint) => boolean;
};

// Lucide's square-dashed with a slash through it, like its other "-off" icons.
const SquareDashedOffPaths = [
  'M5 3a2 2 0 0 0-2 2',
  'M19 3a2 2 0 0 1 2 2',
  'M21 19a2 2 0 0 1-2 2',
  'M5 21a2 2 0 0 1-2-2',
  'M9 3h1',
  'M9 21h1',
  'M14 3h1',
  'M14 21h1',
  'M3 9v1',
  'M21 9v1',
  'M3 14v1',
  'M21 14v1',
  'm2 2 20 20',
];

const SquareDashedOffIcon = createLucideIcon(
  'square-dashed-off',
  SquareDashedOffPaths.map((d) => ['path', {
    d,
    key: d,
  }]),
);

const controlButtonClassName = 'inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-bold text-white transition-colors hover:bg-white/15 disabled:opacity-40 [&_svg]:size-4';

const PlayerTimeDisplay = ({
  controller,
  duration,
}: {
  controller: VideoPlaybackController;
  duration: number;
}) => {
  const time = useVideoTime(controller, 1);

  return (
    <span className="px-1 text-xs font-semibold text-white tabular-nums">
      {formatVideoTime(time)} / {formatVideoTime(duration)}
    </span>
  );
};

export const VideoPlayerCard = ({
  controller,
  sceneRef,
  videoSrc,
  onVideoElement,
  isPlaying,
  duration,
  playbackRate,
  clockOffset,
  isOverlayShown,
  isPicking,
  isWide,
  isMarkingFinishLine,
  onToggleOverlay,
  onToggleWide,
  onToggleFinishLineMarking,
  onCameraMoved,
  onSetClock,
  onFrameClick,
  isClickableAt,
}: VideoPlayerCardProps) => {
  const frameRef = useRef<HTMLDivElement>(null);
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) {
      return;
    }

    const handleWheel = (event: WheelEvent) => {
      controller.handleWheelScrub({
        event,
        isOverBar: false,
        barWidth: frame.clientWidth,
      });
    };

    frame.addEventListener('wheel', handleWheel, {
      passive: false,
    });

    return () => {
      frame.removeEventListener('wheel', handleWheel);
    };
  }, [controller]);

  return (
    <div
      ref={frameRef}
      className="group/player relative aspect-video w-full overflow-hidden rounded-xl bg-neutral-900 shadow-sm overscroll-x-none"
    >
      <video
        ref={onVideoElement}
        src={videoSrc || undefined}
        playsInline
        className="absolute inset-0 size-full object-contain"
      />

      <VideoOverlayCanvas
        controller={controller}
        sceneRef={sceneRef}
        isOverlayShown={isOverlayShown}
        isPicking={isPicking}
        onFrameClick={onFrameClick}
        isClickableAt={isClickableAt}
      />

      <div className="absolute top-3 left-3">
        <RaceClockBadge
          controller={controller}
          clockOffset={clockOffset}
          onSetClock={onSetClock}
        />
      </div>

      <div
        className={cn(
          'pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-linear-to-t from-neutral-950/85 via-neutral-950/50 to-transparent px-3 pt-10 pb-2 *:pointer-events-auto',
          'opacity-0 transition-opacity duration-200 group-hover/player:opacity-100 has-focus-visible:opacity-100 pointer-coarse:opacity-100',
          isToolsMenuOpen && 'opacity-100',
        )}
      >
        <PlayerScrubber
          controller={controller}
          clockOffset={clockOffset}
        />

        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={isPlaying ? 'Pause' : 'Play'}
            title="Space"
            className={controlButtonClassName}
            onClick={() => controller.togglePlay()}
          >
            {isPlaying ? <PauseIcon className="fill-current" /> : <PlayIcon className="fill-current" />}
          </button>

          <button
            type="button"
            title="Back 1 s (Shift + ←)"
            className={controlButtonClassName}
            onClick={() => controller.step(-1)}
          >
            <RotateCcwIcon className="size-3.5!" />
            1s
          </button>

          <button
            type="button"
            title="Forward 1 s (Shift + →)"
            className={controlButtonClassName}
            onClick={() => controller.step(1)}
          >
            1s
            <RotateCwIcon className="size-3.5!" />
          </button>

          <PlayerTimeDisplay
            controller={controller}
            duration={duration}
          />

          <div className="flex-1" />

          <button
            type="button"
            title={isOverlayShown ? 'Hide boxes and bib numbers' : 'Show boxes and bib numbers'}
            className={controlButtonClassName}
            onClick={onToggleOverlay}
          >
            {isOverlayShown ? <SquareDashedIcon strokeWidth={2.5} /> : <SquareDashedOffIcon strokeWidth={2.5} />}
          </button>

          <DropdownMenu
            open={isToolsMenuOpen}
            onOpenChange={setIsToolsMenuOpen}
          >
            <DropdownMenuTrigger
              title="Video tools"
              className={cn(controlButtonClassName, isMarkingFinishLine && 'text-sky-300')}
            >
              <SettingsIcon />
            </DropdownMenuTrigger>

            <DropdownMenuContent
              side="top"
              align="end"
              className="w-56"
            >
              <DropdownMenuItem
                title="Click the two ends of the finish line’s near edge"
                onClick={onToggleFinishLineMarking}
              >
                {isMarkingFinishLine ? 'Stop drawing' : 'Draw finish line'}
                <DropdownMenuShortcut>
                  <Kbd>M</Kbd>
                </DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem
                title="Start a new camera position at the playhead, e.g. after the camera was bumped"
                onClick={onCameraMoved}
              >
                Camera moved here
                <DropdownMenuShortcut>
                  <Kbd>S</Kbd>
                </DropdownMenuShortcut>
              </DropdownMenuItem>

              <DropdownMenuSeparator />
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

          <button
            type="button"
            title={isWide ? 'Show the runner list beside the video' : 'Wider video'}
            className={cn(controlButtonClassName, isWide && 'text-sky-300')}
            onClick={onToggleWide}
          >
            <RectangleHorizontalIcon />
          </button>
        </div>
      </div>
    </div>
  );
};
