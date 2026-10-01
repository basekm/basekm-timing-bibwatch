import { BadRequestException, ConflictException, Injectable, InternalServerErrorException } from '@nestjs/common';

import * as fs from 'fs/promises';
import * as path from 'path';

import { ScanState, ScanStateId } from '../@shared/constants/ScanStateId';
import { ScanClearRequestDto } from '../@shared/dto/ScanClearRequestDto';
import { ScanQueueRequestDto } from '../@shared/dto/ScanQueueRequestDto';
import { ScanStartRequestDto } from '../@shared/dto/ScanStartRequestDto';
import { SegmentsSaveRequestDto } from '../@shared/dto/SegmentsSaveRequestDto';
import { pathExists } from '../@shared/lib/pathExists';
import { writeJsonAtomic } from '../@shared/lib/writeJsonAtomic';
import { BibwatchService } from '../bibwatch/BibwatchService';
import { EventService } from '../event/EventService';
import { FolderService } from '../folder/FolderService';
import { MediaService } from '../media/MediaService';
import { SightingImportService } from '../sightings/SightingImportService';
import { SightingService } from '../sightings/SightingService';
import { VideoService } from '../videos/VideoService';

import { ScanJob, ScanJobOptions } from './ScanJob';

/** The viewer's default for videos not scanned yet (Only look for people). */
const IsPeopleFirstByDefault = true;

type FinishedScan = { video: string; state: ScanState; message: string };

/** Seconds → "HH:MM:SS.s", as the scanner's --clock takes it; null for a clock before midnight. */
const formatClock = (seconds: number) => {
  if (seconds < 0) {
    return null;
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  const whole = Math.floor(seconds);
  const tenths = Math.floor((seconds - whole) * 10);
  return `${pad(Math.floor(whole / 3600))}:${pad(Math.floor(whole / 60) % 60)}:${pad(whole % 60)}.${tenths}`;
};

@Injectable()
export class ScanService {
  /** The one scan that may run at a time (the scanner already uses every core). */
  private job: ScanJob | null = null;
  /** Videos waiting to be scanned after the running one, in order. */
  private queue: string[] = [];
  /** How each scan since the queue was last empty ended, for the viewer to report. */
  private finished: FinishedScan[] = [];

  constructor(
    private readonly bibwatchService: BibwatchService,
    private readonly eventService: EventService,
    private readonly mediaService: MediaService,
    private readonly sightingService: SightingService,
    private readonly sightingImportService: SightingImportService,
    private readonly videoService: VideoService,
    folderService: FolderService,
  ) {
    // A scan writes into the open folder until it ends.
    folderService.addBusyCheck(() =>
      this.isBusy ? `a scan is running (${this.job?.video}) — stop it before opening another folder` : null,
    );
    // The last scan's status belongs to the folder it ran in.
    folderService.onOpened(() => {
      this.job = null;
      this.queue = [];
      this.finished = [];
    });
  }

  async getStatus() {
    const status = this.job ? await this.job.getStatus() : { state: ScanStateId.Idle };
    return { ...status, queue: [...this.queue], finished: [...this.finished] };
  }

  async start(body: ScanStartRequestDto) {
    await this.checkScannerBuilt();
    const videoPath = await this.mediaService.resolveVideo(body.video);

    // Checked and set with no `await` in between, so two clicks can't start two scans.
    if (this.isBusy) {
      throw new ConflictException({
        error: `a scan is already running (${this.job?.video})`,
        ...(await this.getStatus()),
      });
    }
    this.finished = [];
    this.launch(body.video, () => this.scanOptionsOf(body.video, {
      videoPath,
      segments: body.segments ?? null,
      clock: body.clock ?? null,
      peopleFirst: Boolean(body.peopleFirst),
      startAt: body.from ?? null,
    }));

    return this.getStatus();
  }

  /**
   * Scan several videos one after another (one scan already uses every core). Each one is
   * scanned the way the viewer's Run scan would from the start of the video: its saved camera
   * positions, race clock and people-only setting.
   */
  async enqueue(body: ScanQueueRequestDto) {
    await this.checkScannerBuilt();
    for (const video of body.videos) {
      await this.mediaService.resolveVideo(video);
    }

    // No `await` from here on, so the queue can't change under us.
    const waiting = new Set(this.queue);
    if (this.job?.isRunning) {
      waiting.add(this.job.video);
    }
    if (!this.isBusy) {
      this.finished = [];
    }
    for (const video of body.videos) {
      if (!waiting.has(video)) {
        waiting.add(video);
        this.queue.push(video);
      }
    }
    if (!this.job?.isRunning) {
      this.startNext();
    }

    return this.getStatus();
  }

  async cancel() {
    this.queue = [];
    this.job?.cancel();
    return this.getStatus();
  }

  private get isBusy() {
    return Boolean(this.job?.isRunning || this.queue.length);
  }

  private async checkScannerBuilt() {
    if (!(await this.bibwatchService.isBuilt())) {
      throw new InternalServerErrorException({ error: 'scanner not built — run: swift build -c release' });
    }
  }

  /** Makes `video` the running scan right away; its options are worked out once it's the one shown. */
  private launch(video: string, getOptions: () => Promise<ScanJobOptions>) {
    const job = new ScanJob(
      video,
      this.mediaService.scanFolderOf(video),
      this.mediaService.scanFolderUrlOf(video),
      this.bibwatchService,
    );
    this.job = job;

    // Not awaited: the scan runs in the background and the viewer polls getStatus().
    // When it ends (done, failed or cancelled), the next queued video starts and what it saved
    // goes into the database for search.
    const run = getOptions().then(
      (options) => (job.isCancelled ? undefined : job.run(options)),
      (error) => job.fail(String(error?.response?.error ?? error?.message ?? error)),
    );
    void run
      .then(() => {
        // Another folder was opened meanwhile: its queue is gone.
        if (this.job === job) {
          this.finished.push({ video, state: job.state, message: job.message });
          if (!job.isCancelled) {
            this.startNext();
          }
        }
        return this.sightingImportService.importDetections(video);
      })
      .catch(() => undefined);
  }

  private startNext() {
    const video = this.queue.shift();
    if (video === undefined) {
      return;
    }
    this.launch(video, async () => {
      const saved = await this.videoService.getByName(video);
      return this.scanOptionsOf(video, {
        videoPath: await this.mediaService.resolveVideo(video),
        segments: null,
        clock: saved?.clockOffset != null ? formatClock(saved.clockOffset) : null,
        peopleFirst: (await this.savedReaderOf(video)) ?? IsPeopleFirstByDefault,
        startAt: null,
      });
    });
  }

  private async scanOptionsOf(
    video: string,
    options: Pick<ScanJobOptions, 'videoPath' | 'segments' | 'clock' | 'peopleFirst' | 'startAt'>,
  ): Promise<ScanJobOptions> {
    const media = this.mediaService.folder;
    const optional = async (file: string) => ((await pathExists(file)) ? file : null);

    return {
      ...options,
      targetsPath: await optional(path.join(media, 'targets.txt')),
      registeredPath: await optional(path.join(media, 'registered.txt')),
      bibArgs: this.eventService.bibArgsOf(await this.eventService.getBibRules()),
    };
  }

  /** Whether the video's saved scan read people only; null when it has none. A scan keeps the way it was made. */
  private async savedReaderOf(video: string) {
    const file = path.join(this.mediaService.scanFolderOf(video), 'detections.json');
    try {
      const detections = JSON.parse(await fs.readFile(file, 'utf8'));
      return detections?.settings ? detections.settings.reader === 'people-first' : null;
    } catch {
      return null;
    }
  }

  /**
   * Delete this video's saved scan (frames read, crossings) — optionally keeping the
   * user's mats / camera-segment edits (segments.json). Only files bibwatch wrote.
   */
  async clear(body: ScanClearRequestDto) {
    if (!this.mediaService.resolve(body.video)) {
      throw new BadRequestException({ error: `video not in the media folder: ${body.video}` });
    }
    if (this.job?.video === body.video && this.job.isRunning) {
      throw new ConflictException({ error: 'a scan of this video is running — cancel it first' });
    }
    if (this.queue.includes(body.video)) {
      throw new ConflictException({ error: 'this video is waiting to be scanned — stop the scans first' });
    }

    const folder = this.mediaService.scanFolderOf(body.video);
    const names = ['detections.json', 'crossings.csv', '.segments.json.tmp'];
    if (!body.keepSegments) {
      names.push('segments.json');
    }

    const removed = [];
    for (const name of names) {
      const removedOk = await fs.rm(path.join(folder, name)).then(() => true, () => false);
      if (removedOk) {
        removed.push(name);
      }
    }
    if (removed.includes('detections.json')) {
      await this.sightingService.deleteForVideo(body.video);
    }

    const left = await fs.readdir(folder).catch(() => null);
    if (left && left.length === 0) {
      await fs.rmdir(folder);
    }

    return { removed };
  }

  /** Mats and camera-segment edits from the viewer, saved as the user makes them. */
  async saveSegments(body: SegmentsSaveRequestDto) {
    await this.mediaService.resolveVideo(body.video);
    if (!body.isValid) {
      throw new BadRequestException({ error: 'segments missing' });
    }
    const folder = this.mediaService.scanFolderOf(body.video);
    await fs.mkdir(folder, { recursive: true });
    await writeJsonAtomic(path.join(folder, 'segments.json'), body.segments);

    return { saved: true, at: Date.now() / 1000 };
  }
}
