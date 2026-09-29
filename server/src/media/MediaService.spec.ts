import { BibwatchService } from '../bibwatch/BibwatchService';
import { ConfigService } from '../config/ConfigService';
import { EventService } from '../event/EventService';
import { TemplateService } from '../templates/TemplateService';
import { VideoService } from '../videos/VideoService';

import { MediaService, videoStem } from './MediaService';

const MEDIA = '/videos/race';

const makeMediaService = () =>
  new MediaService({ MediaFolder: MEDIA } as ConfigService, {} as BibwatchService, {} as VideoService);

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

describe('TemplateService.pathOf', () => {
  const templateService = new TemplateService({} as BibwatchService, {} as EventService, makeMediaService());

  it('accepts plain template names', () => {
    expect(templateService.pathOf('Run Fur Fun (5K)-2')).toBe(`${MEDIA}/templates/Run Fur Fun (5K)-2.json`);
  });

  it('rejects anything that could leave media/templates', () => {
    expect(templateService.pathOf('../x')).toBeNull();
    expect(templateService.pathOf('a/b')).toBeNull();
    expect(templateService.pathOf('.hidden')).toBeNull();
    expect(templateService.pathOf('')).toBeNull();
    expect(templateService.pathOf(undefined)).toBeNull();
  });
});
