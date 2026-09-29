import {
  useEffect,
  useState
} from 'react';

import {
  VideoPlaybackController
} from '../utils/VideoPlaybackController';

export const useVideoTime = (controller: VideoPlaybackController, resolutionSeconds: number) => {
  const [quantizedTime, setQuantizedTime] = useState(0);

  useEffect(() => {
    let frameId = 0;

    const tick = () => {
      const quantized = Math.floor(controller.currentTime / resolutionSeconds) * resolutionSeconds;
      setQuantizedTime((previous) => (previous === quantized ? previous : quantized));
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [controller, resolutionSeconds]);

  return quantizedTime;
};
