import {
  useCallback,
  useRef,
  useSyncExternalStore
} from 'react';

import {
  CameraSyncController
} from '../utils/CameraSyncController';

export type CameraSyncSnapshot = {
  raceTime: number;
  isPlaying: boolean;
  playbackRate: number;
};

/** The race clock as React state, rounded to `resolutionSeconds` so a playing clock doesn't re-render every frame. */
export const useCameraSync = (controller: CameraSyncController, resolutionSeconds: number) => {
  const snapshotRef = useRef<CameraSyncSnapshot>({
    raceTime: 0,
    isPlaying: false,
    playbackRate: 1,
  });

  const getSnapshot = useCallback(() => {
    const raceTime = Math.floor(controller.raceTime / resolutionSeconds) * resolutionSeconds;
    const previous = snapshotRef.current;

    if (
      previous.raceTime !== raceTime
      || previous.isPlaying !== controller.isPlaying
      || previous.playbackRate !== controller.playbackRate
    ) {
      snapshotRef.current = {
        raceTime,
        isPlaying: controller.isPlaying,
        playbackRate: controller.playbackRate,
      };
    }

    return snapshotRef.current;
  }, [controller, resolutionSeconds]);

  const subscribe = useCallback((onChange: () => void) => controller.subscribe(onChange), [controller]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};
