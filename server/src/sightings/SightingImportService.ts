import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';

import * as fs from 'fs/promises';
import * as path from 'path';

import { SightingDto } from '../@shared/dto/SightingsSaveRequestDto';
import { MediaService } from '../media/MediaService';
import { VideoService } from '../videos/VideoService';

import { SightingService } from './SightingService';
import { TagService } from './TagService';

const parseClock = (clock: string) => {
  const parts = String(clock).trim().split(':').map(Number);
  return parts.some(Number.isNaN) ? null : parts.reduce((total, part) => total * 60 + part, 0);
};

/**
 * Brings files into the database: the scanner's detections.json (when newer than what is stored)
 * and tags.json from before tags moved into the database.
 */
@Injectable()
export class SightingImportService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SightingImportService.name);

  constructor(
    private readonly mediaService: MediaService,
    private readonly sightingService: SightingService,
    private readonly tagService: TagService,
    private readonly videoService: VideoService,
  ) {}

  onApplicationBootstrap() {
    // In the background: the viewer is usable while a large media folder is being read in.
    void this.importAll().catch((error) => this.logger.error(`import failed: ${error?.message ?? error}`));
  }

  async importAll() {
    let sightings = 0;
    let tags = 0;
    for (const video of await this.mediaService.getVideos()) {
      if (await this.importDetections(video)) {
        sightings += 1;
      }
      if (await this.importLegacyTags(video)) {
        tags += 1;
      }
    }
    if (sightings || tags) {
      this.logger.log(`imported sightings of ${sightings} video(s), tags of ${tags} video(s)`);
    }
  }

  /** Copy the sightings of this video's detections.json in, if the file is newer than the stored ones. */
  async importDetections(videoName: string) {
    const file = path.join(this.mediaService.scanFolderOf(videoName), 'detections.json');
    const stat = await fs.stat(file).catch(() => null);
    if (!stat) {
      return false;
    }
    const video = await this.videoService.getByName(videoName);
    if (video?.sightingsUpdatedAt && video.sightingsUpdatedAt >= stat.mtime) {
      return false;
    }

    let detections: { sightings?: SightingDto[]; duration?: number; clock?: string };
    try {
      detections = JSON.parse(await fs.readFile(file, 'utf8'));
    } catch {
      return false; // mid-write; the next finished scan or re-sync brings it in
    }

    await this.sightingService.replaceForVideo(videoName, detections.sightings ?? [], {
      duration: detections.duration,
      decidedAt: stat.mtime,
    });

    // A scan run with --clock carries the reader time; keep it unless one was set by hand.
    const clockOffset = detections.clock ? parseClock(detections.clock) : null;
    if (clockOffset != null && (await this.videoService.getByName(videoName))?.clockOffset == null) {
      await this.videoService.setClock(videoName, clockOffset);
    }
    return true;
  }

  /** tags.json from before tags moved into the database: copied in once, then left alone. */
  async importLegacyTags(videoName: string) {
    const file = path.join(this.mediaService.scanFolderOf(videoName), 'tags.json');
    const video = await this.videoService.getByName(videoName);
    if (video?.tagsImportedAt) {
      return false;
    }

    let tags: Record<string, any>;
    try {
      tags = JSON.parse(await fs.readFile(file, 'utf8'));
    } catch {
      return false;
    }
    if (!tags || typeof tags !== 'object' || Array.isArray(tags)) {
      return false;
    }

    await this.tagService.saveTags(videoName, tags);
    return true;
  }
}
