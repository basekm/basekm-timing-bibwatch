import {
  useCallback,
  useRef,
  useSyncExternalStore
} from 'react';

import {
  CameraSyncController
} from '../utils/CameraSyncController';

type CameraSyncParams = {
  controller: CameraSyncController;
  resolutionSeconds: number;
};

export type CameraSyncSnapshot = {
  raceTime: number;
  isPlaying: boolean;
  playbackRate: number;
};

export const useCameraSync = ({
  controller,
  resolutionSeconds,
}: CameraSyncParams) => {
  const snapshotRef = useRef<CameraSyncSnapshot>({
    raceTime: 0,
    isPlaying: false,
    playbackRate: 1,
  });

  const getSnapshot = useCallback(() => {
    const roundedRaceTime = Math.floor(controller.raceTime / resolutionSeconds) * resolutionSeconds;
    const previous = snapshotRef.current;
    const hasChanged = previous.raceTime !== roundedRaceTime
      || previous.isPlaying !== controller.isPlaying
      || previous.playbackRate !== controller.playbackRate;

    if (hasChanged) {
      snapshotRef.current = {
        raceTime: roundedRaceTime,
        isPlaying: controller.isPlaying,
        playbackRate: controller.playbackRate,
      };
    }

    return snapshotRef.current;
  }, [controller, resolutionSeconds]);

  const subscribe = useCallback((onChange: () => void) => controller.subscribe(onChange), [controller]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};
