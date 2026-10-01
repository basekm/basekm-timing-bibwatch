import 'reflect-metadata';

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { DataSource } from 'typeorm';

import { EventSettingsEntity } from '../@shared/entities/EventSettingsEntity';
import { SightingEntity } from '../@shared/entities/SightingEntity';
import { SightingTagEntity } from '../@shared/entities/SightingTagEntity';
import { VideoEntity } from '../@shared/entities/VideoEntity';
import { ConfigService } from '../config/ConfigService';
import { VideoService } from '../videos/VideoService';

import { FolderService } from './FolderService';

describe('FolderService.open', () => {
  let root: string;
  let dataSource: DataSource;
  let folderService: FolderService;

  beforeEach(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'bibwatch-folders-'));
    fs.mkdirSync(path.join(root, 'race-a'));
    fs.mkdirSync(path.join(root, 'race-b'));
    dataSource = await new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: [EventSettingsEntity, SightingEntity, SightingTagEntity, VideoEntity],
      synchronize: true,
    }).initialize();
    folderService = new FolderService(dataSource, { FolderStateFile: path.join(root, 'state', 'folders.json') } as ConfigService);
  });

  afterEach(async () => {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('switches the database with the folder; repositories made before keep working', async () => {
    // Made once, as Nest injects it.
    const videoService = new VideoService(dataSource.getRepository(VideoEntity));

    await folderService.open(path.join(root, 'race-a'));
    await videoService.setClock('GX01.MP4', 100);

    await folderService.open(path.join(root, 'race-b'));
    expect(await videoService.getClocks()).toEqual({});
    await videoService.setClock('GX01.MP4', 200);

    await folderService.open(path.join(root, 'race-a'));
    expect(await videoService.getClocks()).toEqual({ 'GX01.MP4': 100 });
    expect(fs.existsSync(path.join(root, 'race-b', 'bibwatch.sqlite'))).toBe(true);
  });

  it('remembers the open folder and the recent ones', async () => {
    await folderService.open(path.join(root, 'race-a'));
    const folders = await folderService.open(path.join(root, 'race-b'));

    expect(folders.current).toEqual({ path: path.join(root, 'race-b'), name: 'race-b' });
    expect(folders.recent.map((folder) => folder.name)).toEqual(['race-b', 'race-a']);
  });

  it('refuses while busy and stays on the open folder', async () => {
    await folderService.open(path.join(root, 'race-a'));
    folderService.addBusyCheck(() => 'a scan is running');

    await expect(folderService.open(path.join(root, 'race-b'))).rejects.toThrow();
    expect(folderService.folder).toBe(path.join(root, 'race-a'));
  });

  it('refuses something that is not a folder', async () => {
    await expect(folderService.open(path.join(root, 'nope'))).rejects.toThrow();
    expect(folderService.folder).toBeNull();
  });

  it('lists sub-folders and videos, skipping hidden ones', async () => {
    fs.writeFileSync(path.join(root, 'race-a', 'GX02.MP4'), '');
    fs.writeFileSync(path.join(root, 'race-a', 'notes.txt'), '');
    fs.mkdirSync(path.join(root, 'race-a', 'scans'));
    fs.mkdirSync(path.join(root, 'race-a', '.hidden'));

    const listing = await folderService.browse(path.join(root, 'race-a'));

    expect(listing.parent).toBe(root);
    expect(listing.folders.map((folder) => folder.name)).toEqual(['scans']);
    expect(listing.videos).toEqual(['GX02.MP4']);
  });
});
