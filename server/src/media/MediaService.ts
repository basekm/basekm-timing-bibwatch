import { BadRequestException, Injectable } from '@nestjs/common';

import * as fs from 'fs/promises';
import * as path from 'path';

import { isDirectory, isFile, pathExists } from '../@shared/lib/pathExists';
import { BibwatchService } from '../bibwatch/BibwatchService';
import { ConfigService } from '../config/ConfigService';

const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.m4v'];

@Injectable()
export class MediaService {
  constructor(
    private readonly configService: ConfigService,
    private readonly bibwatchService: BibwatchService,
  ) {}

  get folder() {
    return this.configService.MediaFolder;
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

  async getOverview() {
    const names = (await fs.readdir(this.folder)).sort();
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

        scans[name] = {
          tags: await urlOf('tags.json'),
          detections,
          segments: await urlOf('segments.json'),
          updated: detections ? (await fs.stat(path.join(dir, 'detections.json'))).mtimeMs / 1000 : null,
        };
      }
    }

    return {
      videos: names.filter((n) => VIDEO_EXTENSIONS.includes(path.extname(n).toLowerCase())),
      json: names.filter((n) => n.toLowerCase().endsWith('.json')),
      scans,
      targets: await pathExists(path.join(this.folder, 'targets.txt')),
      scanner: await this.bibwatchService.isBuilt(),
    };
  }
}

export const videoStem = (video: string) => video.slice(0, video.length - path.extname(video).length);
