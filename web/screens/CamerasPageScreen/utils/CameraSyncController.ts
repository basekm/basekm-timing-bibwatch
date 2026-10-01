export type SyncedCamera = {
  name: string;
  clockOffset: number | null;
  duration: number | null;
};

export type CameraCoverage = {
  from: number;
  to: number;
};

type VideoTimeAtParams = {
  camera: SyncedCamera;
  raceTime: number;
};

type AttachVideoParams = {
  name: string;
  video: HTMLVideoElement | null;
};

type SetDetachedParams = {
  name: string;
  isDetached: boolean;
};

type SyncVideoParams = {
  name: string;
  isSeek: boolean;
};

const MaxDriftSeconds = 0.3;
const EdgeToleranceSeconds = 0.05;

export const coverageOf = (camera: SyncedCamera): CameraCoverage | null => {
  if (camera.clockOffset === null || !camera.duration) {
    return null;
  }

  return {
    from: camera.clockOffset,
    to: camera.clockOffset + camera.duration,
  };
};

export const rangeOf = (cameras: SyncedCamera[]): CameraCoverage | null => {
  const coverages = cameras
    .map(coverageOf)
    .filter((coverage): coverage is CameraCoverage => coverage !== null);

  if (!coverages.length) {
    return null;
  }

  return {
    from: Math.min(...coverages.map((coverage) => coverage.from)),
    to: Math.max(...coverages.map((coverage) => coverage.to)),
  };
};

export const videoTimeAt = ({
  camera,
  raceTime,
}: VideoTimeAtParams) => {
  const coverage = coverageOf(camera);
  const isRecording = coverage !== null && raceTime >= coverage.from && raceTime <= coverage.to;

  if (!isRecording) {
    return null;
  }

  return raceTime - coverage.from;
};

export class CameraSyncController {
  raceTime = 0;

  isPlaying = false;

  playbackRate = 1;

  private cameras = new Map<string, SyncedCamera>();

  private videos = new Map<string, HTMLVideoElement>();

  private detached = new Set<string>();

  private listeners = new Set<() => void>();

  private frameId = 0;

  private lastTick = 0;

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  setCameras(cameras: SyncedCamera[]) {
    this.cameras = new Map(cameras.map((camera) => [camera.name, camera]));
    this.syncAll(true);
    this.notify();
  }

  attachVideo({
    name,
    video,
  }: AttachVideoParams) {
    if (!video) {
      this.videos.delete(name);
      return;
    }

    this.videos.set(name, video);
    this.syncVideo({
      name,
      isSeek: true,
    });
  }

  setDetached({
    name,
    isDetached,
  }: SetDetachedParams) {
    if (isDetached) {
      this.detached.add(name);
      this.videos.get(name)?.pause();
    } else {
      this.detached.delete(name);
      this.syncVideo({
        name,
        isSeek: true,
      });
    }

    this.notify();
  }

  get range() {
    return rangeOf([...this.cameras.values()]);
  }

  seekTo(raceTime: number) {
    const range = this.range;
    this.raceTime = range ? Math.min(Math.max(raceTime, range.from), range.to) : raceTime;
    this.syncAll(true);
    this.notify();
  }

  step(deltaSeconds: number) {
    this.seekTo(this.raceTime + deltaSeconds);
  }

  setPlaybackRate(rate: number) {
    this.playbackRate = rate;
    this.videos.forEach((video) => {
      video.playbackRate = rate;
    });
    this.notify();
  }

  play() {
    const range = this.range;
    if (!range) {
      return;
    }

    if (this.raceTime >= range.to) {
      this.raceTime = range.from;
    }

    this.isPlaying = true;
    this.lastTick = performance.now();
    this.syncAll(true);
    cancelAnimationFrame(this.frameId);
    this.frameId = requestAnimationFrame(this.tick);
    this.notify();
  }

  pause() {
    this.isPlaying = false;
    cancelAnimationFrame(this.frameId);
    this.videos.forEach((video, name) => {
      if (!this.detached.has(name)) {
        video.pause();
      }
    });
    this.syncAll(true);
    this.notify();
  }

  togglePlay() {
    if (this.isPlaying) {
      this.pause();
      return;
    }

    this.play();
  }

  dispose() {
    cancelAnimationFrame(this.frameId);
    this.listeners.clear();
  }

  private tick = (now: number) => {
    const range = this.range;
    const elapsedSeconds = (now - this.lastTick) / 1000;
    this.lastTick = now;
    this.raceTime += elapsedSeconds * this.playbackRate;

    if (!range || this.raceTime >= range.to) {
      this.raceTime = range?.to ?? this.raceTime;
      this.pause();
      return;
    }

    this.syncAll(false);
    this.notify();
    this.frameId = requestAnimationFrame(this.tick);
  };

  private syncAll(isSeek: boolean) {
    this.videos.forEach((_, name) => this.syncVideo({
      name,
      isSeek,
    }));
  }

  private syncVideo({
    name,
    isSeek,
  }: SyncVideoParams) {
    const video = this.videos.get(name);
    const camera = this.cameras.get(name);
    if (!video || !camera || this.detached.has(name) || camera.clockOffset === null) {
      return;
    }

    const duration = Number.isFinite(video.duration) ? video.duration : camera.duration ?? 0;
    const target = this.raceTime - camera.clockOffset;
    const isRecording = target >= 0 && target <= duration;

    if (!isRecording) {
      this.restOnNearestEnd({
        video,
        target,
        duration,
        isSeek,
      });
      return;
    }

    const isDrifting = Math.abs(video.currentTime - target) > MaxDriftSeconds * this.playbackRate;
    if (isSeek || isDrifting) {
      video.currentTime = target;
    }

    video.playbackRate = this.playbackRate;
    if (this.isPlaying && video.paused) {
      video.play().catch(() => undefined);
    }
  }

  private restOnNearestEnd({
    video,
    target,
    duration,
    isSeek,
  }: {
    video: HTMLVideoElement;
    target: number;
    duration: number;
    isSeek: boolean;
  }) {
    if (!video.paused) {
      video.pause();
    }

    const nearestEnd = target < 0 ? 0 : duration;
    const isAwayFromEnd = Math.abs(video.currentTime - nearestEnd) > EdgeToleranceSeconds;
    if (isSeek && isAwayFromEnd) {
      video.currentTime = nearestEnd;
    }
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }
}
