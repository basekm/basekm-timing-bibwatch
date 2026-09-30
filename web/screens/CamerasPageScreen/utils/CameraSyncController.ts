export type SyncedCamera = {
  name: string;
  clockOffset: number | null;
  duration: number | null;
};

export type CameraCoverage = {
  from: number;
  to: number;
};

// A playing video that drifts further than this from the race clock is put back in place.
const MaxDriftSeconds = 0.3;

/** The race time a camera covers: video time 0 is race time `clockOffset`. */
export const coverageOf = (camera: SyncedCamera): CameraCoverage | null => {
  if (camera.clockOffset === null || !camera.duration) {
    return null;
  }

  return {
    from: camera.clockOffset,
    to: camera.clockOffset + camera.duration,
  };
};

/** The point in this camera's video that shows `raceTime`, or null when it wasn't recording then. */
export const videoTimeAt = (camera: SyncedCamera, raceTime: number) => {
  const coverage = coverageOf(camera);
  if (!coverage || raceTime < coverage.from || raceTime > coverage.to) {
    return null;
  }

  return raceTime - coverage.from;
};

/**
 * One race clock for every camera. Each camera with a race clock set is "linked": its video shows
 * race time minus its clock offset, so scrubbing or playing the race clock moves them all as one.
 * A camera being lined up (or without a clock) is left alone so it can be moved on its own.
 */
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

  attachVideo(name: string, video: HTMLVideoElement | null) {
    if (video) {
      this.videos.set(name, video);
      this.syncVideo(name, true);
    } else {
      this.videos.delete(name);
    }
  }

  video(name: string) {
    return this.videos.get(name) ?? null;
  }

  /** Stop following the race clock (while lining this camera up), or follow it again. */
  setDetached(name: string, isDetached: boolean) {
    if (isDetached) {
      this.detached.add(name);
      this.videos.get(name)?.pause();
    } else {
      this.detached.delete(name);
      this.syncVideo(name, true);
    }
    this.notify();
  }

  /** Move one camera on its own (while it's being lined up). */
  nudge(name: string, deltaSeconds: number) {
    const video = this.videos.get(name);
    if (!video) {
      return;
    }

    video.pause();
    video.currentTime = Math.max(0, Math.min(video.currentTime + deltaSeconds, video.duration || Infinity));
  }

  get range(): CameraCoverage | null {
    const coverages = [...this.cameras.values()]
      .map(coverageOf)
      .filter((coverage): coverage is CameraCoverage => coverage !== null);

    if (!coverages.length) {
      return null;
    }

    return {
      from: Math.min(...coverages.map((coverage) => coverage.from)),
      to: Math.max(...coverages.map((coverage) => coverage.to)),
    };
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
    } else {
      this.play();
    }
  }

  dispose() {
    cancelAnimationFrame(this.frameId);
    this.listeners.clear();
  }

  private tick = (now: number) => {
    const range = this.range;
    const elapsed = (now - this.lastTick) / 1000;
    this.lastTick = now;
    this.raceTime += elapsed * this.playbackRate;

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
    this.videos.forEach((_, name) => this.syncVideo(name, isSeek));
  }

  private syncVideo(name: string, isSeek: boolean) {
    const video = this.videos.get(name);
    const camera = this.cameras.get(name);
    if (!video || !camera || this.detached.has(name) || camera.clockOffset === null) {
      return;
    }

    const duration = Number.isFinite(video.duration) ? video.duration : camera.duration;
    const target = this.raceTime - camera.clockOffset;
    const isRecording = duration !== null && target >= 0 && target <= duration;

    if (!isRecording) {
      if (!video.paused) {
        video.pause();
      }
      // Rest on the nearest end, so the tile shows the first or last frame.
      const edge = target < 0 ? 0 : duration ?? 0;
      if (isSeek && Math.abs(video.currentTime - edge) > 0.05) {
        video.currentTime = edge;
      }
      return;
    }

    if (isSeek || Math.abs(video.currentTime - target) > MaxDriftSeconds * this.playbackRate) {
      video.currentTime = target;
    }

    video.playbackRate = this.playbackRate;
    if (this.isPlaying && video.paused) {
      video.play().catch(() => undefined);
    }
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }
}
