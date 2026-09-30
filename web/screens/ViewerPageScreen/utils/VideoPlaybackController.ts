import {
  swipeBarFactor,
  swipeSecondsPerPixel
} from '@basekm/@shared/utils/swipeSpeed';

type PendingSeek = {
  time: number;
  isPrecise: boolean;
};

type SwipeState = {
  isActive: boolean;
  wasPlaying: boolean;
  target: number | null;
  lastEnd: number;
  idleTimer: ReturnType<typeof setTimeout> | null;
};

type WheelScrubParams = {
  event: WheelEvent;
  isOverBar: boolean;
  barWidth: number;
};

const SwipeIdleMs = 160;
const SwipeContinueMs = 1000;
const SwipeFlashMs = 700;

export class VideoPlaybackController {
  video: HTMLVideoElement | null = null;

  fallbackDuration = 0;

  previewTime: number | null = null;

  swipeFlashUntil = 0;

  swipeSpeed = 35;

  private pendingSeek: PendingSeek | null = null;

  private isDragging = false;

  private wasPlayingBeforeDrag = false;

  private swipe: SwipeState = {
    isActive: false,
    wasPlaying: false,
    target: null,
    lastEnd: 0,
    idleTimer: null,
  };

  private listeners = new Set<() => void>();

  setSwipeSettings({
    speed,
  }: {
    speed: number;
  }) {
    this.swipeSpeed = speed;
  }

  setFallbackDuration(duration: number) {
    this.fallbackDuration = duration;
  }

  attach(video: HTMLVideoElement | null) {
    if (this.video) {
      this.video.removeEventListener('seeked', this.handleSeeked);
    }

    this.video = video;

    if (video) {
      video.addEventListener('seeked', this.handleSeeked);
    }
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  get duration() {
    const videoDuration = this.video?.duration;
    if (videoDuration && Number.isFinite(videoDuration)) {
      return videoDuration;
    }

    return this.fallbackDuration;
  }

  get currentTime() {
    return this.previewTime ?? this.video?.currentTime ?? 0;
  }

  get isScrubbing() {
    return this.isDragging || this.swipe.isActive;
  }

  get isPaused() {
    return this.video?.paused ?? true;
  }

  togglePlay() {
    if (!this.video) {
      return;
    }

    if (this.video.paused) {
      this.video.play();
    } else {
      this.video.pause();
    }
  }

  pause() {
    this.video?.pause();
  }

  play() {
    this.video?.play();
  }

  setPlaybackRate(rate: number) {
    if (!this.video) {
      return;
    }

    this.video.playbackRate = rate;
    this.notify();
  }

  seekTo(time: number) {
    if (!this.video) {
      return;
    }

    this.swipe.lastEnd = 0;
    this.video.currentTime = Math.min(Math.max(0, time), this.duration || Infinity);
  }

  step(deltaSeconds: number) {
    if (!this.video) {
      return;
    }

    this.video.pause();
    this.seekTo(this.video.currentTime + deltaSeconds);
  }

  requestSeek(time: number, isPrecise: boolean) {
    const video = this.video;
    if (!video) {
      return;
    }

    this.previewTime = time;

    if (video.seeking) {
      this.pendingSeek = {
        time,
        isPrecise,
      };
      return;
    }

    const canFastSeek = !isPrecise && typeof video.fastSeek === 'function';
    if (canFastSeek) {
      video.fastSeek(time);
    } else {
      video.currentTime = time;
    }
  }

  startDrag(time: number) {
    if (!this.video || !this.duration) {
      return;
    }

    this.swipe.lastEnd = 0;
    this.isDragging = true;
    this.wasPlayingBeforeDrag = !this.video.paused;
    this.video.pause();
    this.requestSeek(time, false);
    this.notify();
  }

  moveDrag(time: number) {
    if (!this.isDragging) {
      return;
    }

    this.requestSeek(time, false);
  }

  endDrag(time: number) {
    if (!this.isDragging) {
      return;
    }

    this.isDragging = false;
    this.requestSeek(time, true);

    if (this.wasPlayingBeforeDrag) {
      this.video?.play();
    }

    this.notify();
  }

  handleWheelScrub({
    event,
    isOverBar,
    barWidth,
  }: WheelScrubParams) {
    const duration = this.duration;
    if (!duration || !this.video) {
      return;
    }

    const pixelsPerUnit = (event.deltaMode === 1 && 16) || (event.deltaMode === 2 && 400) || 1;
    let horizontalDelta = event.deltaX * pixelsPerUnit;
    const verticalDelta = event.deltaY * pixelsPerUnit;

    if (isOverBar && Math.abs(verticalDelta) > Math.abs(horizontalDelta)) {
      horizontalDelta = verticalDelta;
    }

    if (!isOverBar && Math.abs(horizontalDelta) <= Math.abs(verticalDelta)) {
      return;
    }

    event.preventDefault();

    if (horizontalDelta === 0) {
      return;
    }

    if (!this.swipe.isActive) {
      const isContinuing = this.swipe.lastEnd > 0 && performance.now() - this.swipe.lastEnd < SwipeContinueMs && this.swipe.target !== null;
      this.swipe.isActive = true;
      this.swipe.wasPlaying = !this.video.paused;
      this.swipe.target = isContinuing ? this.swipe.target : (this.previewTime ?? this.video.currentTime);
      this.video.pause();
      this.notify();
    }

    const boost = event.altKey ? 10 : 1;
    const barSecondsPerPixel = (duration / Math.max(barWidth, 1)) * swipeBarFactor(this.swipeSpeed);
    const secondsPerPixel = (isOverBar ? barSecondsPerPixel : swipeSecondsPerPixel(this.swipeSpeed)) * boost;
    const target = Math.min(Math.max((this.swipe.target ?? 0) + horizontalDelta * secondsPerPixel, 0), duration);

    this.swipe.target = target;
    this.requestSeek(target, false);
    this.swipeFlashUntil = performance.now() + SwipeFlashMs;

    if (this.swipe.idleTimer) {
      clearTimeout(this.swipe.idleTimer);
    }

    this.swipe.idleTimer = setTimeout(() => {
      this.swipe.isActive = false;
      this.swipe.lastEnd = performance.now();
      this.requestSeek(target, true);

      if (this.swipe.wasPlaying) {
        this.video?.play();
      }

      this.notify();
    }, SwipeIdleMs);
  }

  private handleSeeked = () => {
    if (this.pendingSeek) {
      const pending = this.pendingSeek;
      this.pendingSeek = null;
      this.requestSeek(pending.time, pending.isPrecise);
      return;
    }

    if (!this.isDragging && !this.swipe.isActive) {
      this.previewTime = null;
    }
  };

  private notify() {
    this.listeners.forEach((listener) => listener());
  }
}
