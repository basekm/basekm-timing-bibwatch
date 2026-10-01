import { BadRequestException, ConflictException, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';

import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { DataSource } from 'typeorm';

import { Mutex } from '../@shared/lib/Mutex';
import { isDirectory } from '../@shared/lib/pathExists';
import { writeJsonAtomic } from '../@shared/lib/writeJsonAtomic';
import { ConfigService } from '../config/ConfigService';

const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.m4v'];
const RECENT_LIMIT = 8;

type FolderState = { current: string | null; recent: string[] };

export const isVideoName = (name: string) => VIDEO_EXTENSIONS.includes(path.extname(name).toLowerCase());

const expandHome = (folder: string) => (folder === '~' || folder.startsWith('~/') ? path.join(os.homedir(), folder.slice(1)) : folder);

const folderInfo = (folder: string) => ({ path: folder, name: path.basename(folder) || folder });

const byName = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

/**
 * The folder being worked on: its videos, scans/ and bibwatch.sqlite (sightings, tags, clocks).
 * Opened from the viewer like a folder in Finder; the last one is opened again on start.
 */
@Injectable()
export class FolderService implements OnApplicationBootstrap {
  private readonly logger = new Logger(FolderService.name);
  private readonly mutex = new Mutex();
  private readonly openedListeners: ((folder: string) => void)[] = [];
  private readonly busyChecks: (() => string | null)[] = [];
  private current: string | null = null;

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    const { current } = await this.readState();
    if (current && (await isDirectory(current))) {
      await this.open(current).catch((error) => this.logger.error(`could not open ${current}: ${error?.message ?? error}`));
    }
  }

  /** The open folder, or null before one is opened. */
  get folder() {
    return this.current;
  }

  /** The open folder, or a 409 telling the viewer to open one. */
  requireFolder() {
    if (!this.current) {
      throw new ConflictException({ error: 'no folder open — open the folder with the race videos first' });
    }
    return this.current;
  }

  /** Called with the new folder each time one is opened (its database is ready by then). */
  onOpened(listener: (folder: string) => void) {
    this.openedListeners.push(listener);
  }

  /** A reason the folder can't be switched right now (e.g. a scan is running), or null. */
  addBusyCheck(check: () => string | null) {
    this.busyChecks.push(check);
  }

  async getFolders() {
    const { recent } = await this.readState();
    return {
      current: this.current ? folderInfo(this.current) : null,
      recent: await Promise.all(recent.map(async (folder) => ({ ...folderInfo(folder), exists: await isDirectory(folder) }))),
      places: await this.getPlaces(),
    };
  }

  /** The sub-folders and videos of `requested` (default: the open folder's parent, else home). */
  async browse(requested?: string) {
    const fallback = this.current ? path.dirname(this.current) : os.homedir();
    const folder = path.resolve(expandHome(requested?.trim() || fallback));
    if (!(await isDirectory(folder))) {
      throw new BadRequestException({ error: `not a folder: ${folder}` });
    }

    const entries = await fs.readdir(folder, { withFileTypes: true }).catch((error) => {
      throw new BadRequestException({ error: `can't read ${folder}: ${error.code ?? error.message}` });
    });
    const folders: string[] = [];
    const videos: string[] = [];
    for (const entry of entries) {
      if (entry.name.startsWith('.')) {
        continue;
      }
      // Symlinks count as what they point to, as they do in the media folder.
      const full = path.join(folder, entry.name);
      const isDir = entry.isDirectory() || (entry.isSymbolicLink() && (await isDirectory(full)));
      if (isDir) {
        folders.push(entry.name);
      } else if (isVideoName(entry.name)) {
        videos.push(entry.name);
      }
    }

    const parent = path.dirname(folder);
    return {
      ...folderInfo(folder),
      parent: parent === folder ? null : parent,
      folders: folders.sort(byName).map((name) => folderInfo(path.join(folder, name))),
      videos: videos.sort(byName),
    };
  }

  /** Switch to `requested`: its database is opened (created if new) and it becomes the folder the viewer shows. */
  async open(requested: string) {
    const folder = path.resolve(expandHome(requested.trim()));
    if (!(await isDirectory(folder))) {
      throw new BadRequestException({ error: `not a folder: ${folder}` });
    }

    await this.mutex.run(async () => {
      if (folder === this.current) {
        return;
      }
      const busy = this.busyChecks.map((check) => check()).find(Boolean);
      if (busy) {
        throw new ConflictException({ error: busy });
      }

      await this.openDatabase(path.join(folder, 'bibwatch.sqlite')).catch(async (error) => {
        // Back to the folder that was open, so the viewer keeps working.
        await this.openDatabase(this.current ? path.join(this.current, 'bibwatch.sqlite') : ':memory:');
        throw new BadRequestException({ error: `can't open the database in ${folder}: ${error?.message ?? error}` });
      });
      this.current = folder;
      this.logger.log(`opened ${folder}`);
      this.openedListeners.forEach((listener) => listener(folder));
    });

    await this.remember(folder);
    return this.getFolders();
  }

  private async openDatabase(database: string) {
    if (this.dataSource.isInitialized) {
      await this.dataSource.destroy();
    }
    this.dataSource.setOptions({ database });
    await this.dataSource.initialize();
  }

  /** Home, the usual video folders and plugged-in drives (cards and SSDs from the cameras). */
  private async getPlaces() {
    const home = os.homedir();
    const places = [home, ...['Desktop', 'Movies', 'Downloads'].map((name) => path.join(home, name))];
    const volumes = await fs.readdir('/Volumes').catch(() => [] as string[]);
    for (const name of volumes.sort(byName)) {
      const full = path.join('/Volumes', name);
      // The startup disk shows up here as a link to "/".
      if (!name.startsWith('.') && (await fs.realpath(full).catch(() => '/')) !== '/') {
        places.push(full);
      }
    }
    const existing = [];
    for (const place of places) {
      if (await isDirectory(place)) {
        existing.push(folderInfo(place));
      }
    }
    return existing;
  }

  private async readState(): Promise<FolderState> {
    const text = await fs.readFile(this.configService.FolderStateFile, 'utf8').catch(() => null);
    const state = text ? JSON.parse(text) : {};
    return {
      current: typeof state.current === 'string' ? state.current : null,
      recent: Array.isArray(state.recent) ? state.recent.filter((folder) => typeof folder === 'string') : [],
    };
  }

  private async remember(folder: string) {
    const { recent } = await this.readState();
    const state: FolderState = {
      current: folder,
      recent: [folder, ...recent.filter((other) => other !== folder)].slice(0, RECENT_LIMIT),
    };
    await fs.mkdir(path.dirname(this.configService.FolderStateFile), { recursive: true });
    await writeJsonAtomic(this.configService.FolderStateFile, state);
  }
}
