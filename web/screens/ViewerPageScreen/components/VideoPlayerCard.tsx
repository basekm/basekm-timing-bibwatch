'use client';

import {
  RefObject,
  useEffect,
  useRef
} from 'react';

import {
  PauseIcon,
  PlayIcon,
  RectangleHorizontalIcon,
  RotateCcwIcon,
  RotateCwIcon,
  SquareDashedIcon
} from 'lucide-react';

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
  onToggleOverlay: () => void;
  onToggleWide: () => void;
  onSetClock: () => void;
  onFrameClick: (point: FramePoint) => void;
};

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
  onToggleOverlay,
  onToggleWide,
  onSetClock,
  onFrameClick,
}: VideoPlayerCardProps) => {
  const frameRef = useRef<HTMLDivElement>(null);

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

  const nextPlaybackRate = PlaybackRates[(PlaybackRates.indexOf(playbackRate) + 1) % PlaybackRates.length] ?? 1;
  const isCenterPlayShown = !isPlaying && !isPicking && duration > 0;

  const handleCyclePlaybackRate = () => {
    controller.setPlaybackRate(nextPlaybackRate);
  };

  return (
    <div
      ref={frameRef}
      className="relative aspect-video w-full overflow-hidden rounded-xl bg-neutral-900 shadow-sm overscroll-x-none"
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
      />

      <div className="absolute top-3 left-3">
        <RaceClockBadge
          controller={controller}
          clockOffset={clockOffset}
          onSetClock={onSetClock}
        />
      </div>

      {isCenterPlayShown && (
        <button
          type="button"
          aria-label="Play"
          className="absolute top-1/2 left-1/2 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-neutral-950/55 text-white backdrop-blur-sm transition-colors hover:bg-neutral-950/75"
          onClick={() => controller.play()}
        >
          <PlayIcon className="ml-1 size-7 fill-current" />
        </button>
      )}

      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-linear-to-t from-neutral-950/85 via-neutral-950/50 to-transparent px-3 pt-10 pb-2">
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
            className={cn(controlButtonClassName, !isOverlayShown && 'text-white/50')}
            onClick={onToggleOverlay}
          >
            <SquareDashedIcon />
          </button>

          <button
            type="button"
            title="Playback speed (L plays faster, K pauses)"
            className={cn(controlButtonClassName, 'min-w-10 justify-center tabular-nums')}
            onClick={handleCyclePlaybackRate}
          >
            {playbackRate}×
          </button>

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
