import { BadRequestException, Injectable } from '@nestjs/common';

import * as fs from 'fs/promises';
import * as path from 'path';

import { isDirectory, isFile, pathExists } from '../@shared/lib/pathExists';
import { BibwatchService } from '../bibwatch/BibwatchService';
import { FolderService, isVideoName } from '../folder/FolderService';
import { VideoService } from '../videos/VideoService';

@Injectable()
export class MediaService {
  constructor(
    private readonly folderService: FolderService,
    private readonly bibwatchService: BibwatchService,
    private readonly videoService: VideoService,
  ) {}

  /** The open folder (a 409 if none is open yet). */
  get folder() {
    return this.folderService.requireFolder();
  }

  /**
   * A path inside the media folder, or null if `relative` escapes it.
   * Lexical only (not realpath): blocks "../" but allows symlinks placed in the media folder.
   */
  resolve(relative: string) {
    const full = path.join(this.folder, relative);
    return full.startsWith(this.folder + path.sep) ? full : null;
  }

  /** The video file for `relative`, or a 400 if it is not a file in the media folder. */
  async resolveVideo(relative: string) {
    const full = this.resolve(relative || '');
    if (!full || !(await isFile(full))) {
      throw new BadRequestException({ error: `video not in the media folder: ${relative}` });
    }
    return full;
  }

  /** Where scans of `video` are saved: <media>/scans/<video name without extension>. */
  scanFolderOf(video: string) {
    return path.join(this.folder, 'scans', videoStem(video));
  }

  scanFolderUrlOf(video: string) {
    return `/media/scans/${videoStem(video)}`;
  }

  /** Video files at the top of the media folder (the Library). */
  async getVideos() {
    const names = await fs.readdir(this.folder);
    return names.filter(isVideoName).sort();
  }

  async getOverview() {
    if (!this.folderService.folder) {
      return { folder: null, videos: [], json: [], scans: {}, targets: false, scanner: await this.bibwatchService.isBuilt(), clocks: {} };
    }
    const names = (await fs.readdir(this.folder)).sort();
    const videos = await this.getVideos();
    const videoOfStem = new Map(videos.map((video) => [videoStem(video), video]));
    const scans: Record<string, object> = {};
    const scanRoot = path.join(this.folder, 'scans');

    if (await isDirectory(scanRoot)) {
      for (const name of (await fs.readdir(scanRoot)).sort()) {
        const dir = path.join(scanRoot, name);
        if (name.startsWith('.') || !(await isDirectory(dir))) {
          continue;
        }
        const urlOf = async (file: string) =>
          (await pathExists(path.join(dir, file))) ? `/media/scans/${name}/${file}` : null;
        const detections = await urlOf('detections.json');

        // Your tags are in the database; tags.json (older scans) is copied in on first start.
        const video = videoOfStem.get(name);
        scans[name] = {
          tags: video ? `/api/tags?video=${encodeURIComponent(video)}` : await urlOf('tags.json'),
          detections,
          segments: await urlOf('segments.json'),
          updated: detections ? (await fs.stat(path.join(dir, 'detections.json'))).mtimeMs / 1000 : null,
        };
      }
    }

    return {
      folder: { path: this.folder, name: path.basename(this.folder) },
      videos,
      json: names.filter((n) => n.toLowerCase().endsWith('.json')),
      scans,
      targets: await pathExists(path.join(this.folder, 'targets.txt')),
      scanner: await this.bibwatchService.isBuilt(),
      clocks: await this.videoService.getClocks(),
    };
  }
}

export const videoStem = (video: string) => video.slice(0, video.length - path.extname(video).length);
