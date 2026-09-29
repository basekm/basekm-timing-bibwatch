'use client';

import {
  PointerEvent,
  useEffect,
  useRef,
  useState
} from 'react';

import {
  formatClockTime,
  formatVideoTime
} from '@basekm/@shared/utils/formatTime';

import {
  VideoPlaybackController
} from '../utils/VideoPlaybackController';

type PlayerScrubberProps = {
  controller: VideoPlaybackController;
  clockOffset: number | null;
};

type HoverTip = {
  left: number;
  text: string;
};

export const PlayerScrubber = ({
  controller,
  clockOffset,
}: PlayerScrubberProps) => {
  const barRef = useRef<HTMLDivElement>(null);
  const playedRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const [hoverTip, setHoverTip] = useState<HoverTip | null>(null);

  useEffect(() => {
    let frameId = 0;

    const update = () => {
      const bar = barRef.current;
      const duration = controller.duration;
      const fraction = duration ? Math.min(Math.max(controller.currentTime / duration, 0), 1) : 0;

      if (bar && playedRef.current && knobRef.current) {
        playedRef.current.style.transform = `scaleX(${fraction})`;
        knobRef.current.style.transform = `translateX(${fraction * bar.clientWidth}px)`;
      }

      frameId = requestAnimationFrame(update);
    };

    frameId = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [controller]);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) {
      return;
    }

    const handleWheel = (event: WheelEvent) => {
      controller.handleWheelScrub({
        event,
        isOverBar: true,
        barWidth: bar.clientWidth,
      });
    };

    bar.addEventListener('wheel', handleWheel, {
      passive: false,
    });

    return () => {
      bar.removeEventListener('wheel', handleWheel);
    };
  }, [controller]);

  const timeAtPointer = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const fraction = Math.min(Math.max((event.clientX - bounds.left) / bounds.width, 0), 1);
    return fraction * controller.duration;
  };

  const showHoverTip = (event: PointerEvent<HTMLDivElement>, time: number) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const readerText = clockOffset === null ? '' : ` · ${formatClockTime(clockOffset + time)}`;

    setHoverTip({
      left: Math.min(Math.max(event.clientX - bounds.left, 40), bounds.width - 40),
      text: `${formatVideoTime(time, true)}${readerText}`,
    });
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!controller.duration) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    const time = timeAtPointer(event);
    showHoverTip(event, time);
    controller.startDrag(time);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!controller.duration) {
      return;
    }

    const time = timeAtPointer(event);
    showHoverTip(event, time);
    controller.moveDrag(time);
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    controller.endDrag(timeAtPointer(event));
  };

  const handlePointerLeave = () => {
    if (!controller.isScrubbing) {
      setHoverTip(null);
    }
  };

  return (
    <div
      ref={barRef}
      className="group/scrubber relative h-5 cursor-pointer touch-none overscroll-x-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerLeave}
    >
      <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-white/25 transition-all group-hover/scrubber:h-1.5">
        <div
          ref={playedRef}
          className="absolute inset-0 origin-left scale-x-0 bg-red-500 will-change-transform"
        />
      </div>

      <div
        ref={knobRef}
        className="pointer-events-none absolute top-1/2 -mt-1.5 -ml-1.5 size-3 rounded-full bg-red-500 shadow-sm will-change-transform transition-[width,height] group-hover/scrubber:-mt-2 group-hover/scrubber:-ml-2 group-hover/scrubber:size-4"
      />

      {hoverTip && (
        <div
          className="pointer-events-none absolute bottom-6 -translate-x-1/2 rounded-md bg-neutral-950/90 px-2 py-1 text-xs font-semibold whitespace-nowrap text-white tabular-nums"
          style={{
            left: hoverTip.left,
          }}
        >
          {hoverTip.text}
        </div>
      )}
    </div>
  );
};
