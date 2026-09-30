import 'reflect-metadata';

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { DataSource } from 'typeorm';

import { EventSettingsEntity } from '../@shared/entities/EventSettingsEntity';
import { SightingEntity } from '../@shared/entities/SightingEntity';
import { SightingTagEntity } from '../@shared/entities/SightingTagEntity';
import { VideoEntity } from '../@shared/entities/VideoEntity';

import { VideoService } from './VideoService';

const openDatabase = (database: string) => new DataSource({
  type: 'better-sqlite3',
  database,
  entities: [EventSettingsEntity, SightingEntity, SightingTagEntity, VideoEntity],
  synchronize: true,
}).initialize();

describe('VideoService.setClock', () => {
  let folder: string;

  beforeEach(() => {
    folder = fs.mkdtempSync(path.join(os.tmpdir(), 'bibwatch-videos-'));
  });

  afterEach(() => {
    fs.rmSync(folder, { recursive: true, force: true });
  });

  it('sets the race clock of a video seen for the first time', async () => {
    const dataSource = await openDatabase(path.join(folder, 'bibwatch.sqlite'));
    const videoService = new VideoService(dataSource.getRepository(VideoEntity));

    await videoService.setClock('A.MP4', 21600);
    expect(await videoService.getClocks()).toEqual({ 'A.MP4': 21600 });

    await dataSource.destroy();
  });

  it('sets the race clock of a video that already has a row, e.g. from a scan before the server started', async () => {
    const file = path.join(folder, 'bibwatch.sqlite');
    const before = await openDatabase(file);
    await before.getRepository(VideoEntity).insert({ name: 'B.MP4' });
    await before.destroy();

    // A fresh connection: its first insert is the one ignored for the existing row.
    const dataSource = await openDatabase(file);
    const videoService = new VideoService(dataSource.getRepository(VideoEntity));

    await videoService.setClock('B.MP4', 22200.5);
    expect(await videoService.getClocks()).toEqual({ 'B.MP4': 22200.5 });

    await dataSource.destroy();
  });
});
