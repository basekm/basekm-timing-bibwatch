import { BibwatchService } from '../bibwatch/BibwatchService';
import { FolderService } from '../folder/FolderService';
import { VideoService } from '../videos/VideoService';

import { MediaService, videoStem } from './MediaService';

const MEDIA = '/videos/race';

const makeMediaService = () =>
  new MediaService({ requireFolder: () => MEDIA } as FolderService, {} as BibwatchService, {} as VideoService);

describe('MediaService.resolve', () => {
  const mediaService = makeMediaService();

  it('keeps paths inside the media folder', () => {
    expect(mediaService.resolve('GX011760.MP4')).toBe(`${MEDIA}/GX011760.MP4`);
    expect(mediaService.resolve('scans/GX011760/tags.json')).toBe(`${MEDIA}/scans/GX011760/tags.json`);
  });

  it('rejects paths that escape it', () => {
    expect(mediaService.resolve('../secret.mp4')).toBeNull();
    expect(mediaService.resolve('scans/../../secret.mp4')).toBeNull();
    expect(mediaService.resolve('../race-other/x.mp4')).toBeNull();
    expect(mediaService.resolve('')).toBeNull();
    expect(mediaService.resolve('.')).toBeNull();
  });

  it('treats absolute paths as relative to the media folder', () => {
    expect(mediaService.resolve('/etc/passwd')).toBe(`${MEDIA}/etc/passwd`);
  });
});

describe('videoStem', () => {
  it('drops only the extension', () => {
    expect(videoStem('GX011760.MP4')).toBe('GX011760');
    expect(videoStem('race.day.1.mov')).toBe('race.day.1');
  });
});
