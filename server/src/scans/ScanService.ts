import { BadRequestException, ConflictException, Injectable, InternalServerErrorException } from '@nestjs/common';

import * as fs from 'fs/promises';
import * as path from 'path';

import { ScanStateId } from '../@shared/constants/ScanStateId';
import { ScanClearRequestDto } from '../@shared/dto/ScanClearRequestDto';
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

import { ScanJob } from './ScanJob';

@Injectable()
export class ScanService {
  /** The one scan that may run at a time (the scanner already uses every core). */
  private job: ScanJob | null = null;

  constructor(
    private readonly bibwatchService: BibwatchService,
    private readonly eventService: EventService,
    private readonly mediaService: MediaService,
    private readonly sightingService: SightingService,
    private readonly sightingImportService: SightingImportService,
    folderService: FolderService,
  ) {
    // A scan writes into the open folder until it ends.
    folderService.addBusyCheck(() =>
      this.job?.isRunning ? `a scan is running (${this.job.video}) — stop it before opening another folder` : null,
    );
    // The last scan's status belongs to the folder it ran in.
    folderService.onOpened(() => {
      this.job = null;
    });
  }

  async getStatus() {
    return this.job ? this.job.getStatus() : { state: ScanStateId.Idle };
  }

  async start(body: ScanStartRequestDto) {
    if (!(await this.bibwatchService.isBuilt())) {
      throw new InternalServerErrorException({ error: 'scanner not built — run: swift build -c release' });
    }
    const videoPath = await this.mediaService.resolveVideo(body.video);

    // Checked and set with no `await` in between, so two clicks can't start two scans.
    if (this.job?.isRunning) {
      throw new ConflictException({
        error: `a scan is already running (${this.job.video})`,
        ...(await this.job.getStatus()),
      });
    }
    const job = new ScanJob(
      body.video,
      this.mediaService.scanFolderOf(body.video),
      this.mediaService.scanFolderUrlOf(body.video),
      this.bibwatchService,
    );
    this.job = job;

    const media = this.mediaService.folder;
    const optional = async (file: string) => ((await pathExists(file)) ? file : null);

    const registeredPath = await optional(path.join(media, 'registered.txt'));

    // Not awaited: the scan runs in the background and the viewer polls getStatus().
    // When it ends (done, failed or cancelled), what it saved goes into the database for search.
    const run = job.run({
      videoPath,
      segments: body.segments ?? null,
      clock: body.clock ?? null,
      targetsPath: await optional(path.join(media, 'targets.txt')),
      registeredPath,
      bibArgs: this.eventService.bibArgsOf(await this.eventService.getBibRules()),
      peopleFirst: Boolean(body.peopleFirst),
      startAt: body.from ?? null,
    });
    void run.then(() => this.sightingImportService.importDetections(body.video)).catch(() => undefined);

    return job.getStatus();
  }

  async cancel() {
    this.job?.cancel();
    return this.getStatus();
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
