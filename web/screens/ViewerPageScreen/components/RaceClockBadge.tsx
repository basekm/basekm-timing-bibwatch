'use client';

import {
  TimerIcon
} from 'lucide-react';

import {
  formatClockTime
} from '@basekm/@shared/utils/formatTime';

import {
  useVideoTime
} from '../hooks/useVideoTime';
import {
  VideoPlaybackController
} from '../utils/VideoPlaybackController';

type RaceClockBadgeProps = {
  controller: VideoPlaybackController;
  clockOffset: number | null;
  onSetClock: () => void;
};

export const RaceClockBadge = ({
  controller,
  clockOffset,
  onSetClock,
}: RaceClockBadgeProps) => {
  const time = useVideoTime(controller, 0.1);

  if (clockOffset === null) {
    return (
      <div className="flex items-center gap-1.5 rounded-md bg-neutral-950/80 px-2.5 py-1.5 text-xs font-bold text-white">
        <TimerIcon className="size-3.5" />
        <span>Race clock not set</span>
        <span>·</span>
        <button
          type="button"
          className="text-sky-300 underline underline-offset-2 hover:text-sky-200"
          onClick={onSetClock}
        >
          Set…
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="flex items-center gap-1.5 rounded-md bg-neutral-950/80 px-2.5 py-1.5 text-xs font-bold text-white tabular-nums hover:bg-neutral-950"
      onClick={onSetClock}
    >
      <TimerIcon className="size-3.5" />
      <span className="font-semibold text-white/70">Race clock</span>
      <span>{formatClockTime(clockOffset + time)}</span>
    </button>
  );
};
