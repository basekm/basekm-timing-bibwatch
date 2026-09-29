import {
  useEffect,
  useState
} from 'react';

export type VideoElementState = {
  isPlaying: boolean;
  duration: number;
  playbackRate: number;
  pausedAt: number | null;
  hasMetadata: boolean;
};

const InitialVideoElementState: VideoElementState = {
  isPlaying: false,
  duration: 0,
  playbackRate: 1,
  pausedAt: null,
  hasMetadata: false,
};

const readVideoElementState = (video: HTMLVideoElement): VideoElementState => {
  const duration = Number.isFinite(video.duration) ? video.duration : 0;

  return {
    isPlaying: !video.paused,
    duration,
    playbackRate: video.playbackRate,
    pausedAt: video.paused && !video.seeking ? video.currentTime : null,
    hasMetadata: video.readyState >= 1,
  };
};

export const useVideoElementState = (video: HTMLVideoElement | null) => {
  const [state, setState] = useState<VideoElementState>(InitialVideoElementState);

  useEffect(() => {
    if (!video) {
      return;
    }

    const update = () => {
      setState(readVideoElementState(video));
    };
    const events = ['play', 'pause', 'seeked', 'loadedmetadata', 'durationchange', 'ratechange', 'emptied'];

    events.forEach((eventName) => video.addEventListener(eventName, update));
    update();

    return () => {
      events.forEach((eventName) => video.removeEventListener(eventName, update));
    };
  }, [video]);

  return state;
};
