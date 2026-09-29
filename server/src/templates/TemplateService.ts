import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import * as fs from 'fs/promises';
import * as path from 'path';

import { FinderQueryDto } from '../@shared/dto/FinderQueryDto';
import { TemplateCalibrateRequestDto } from '../@shared/dto/TemplateCalibrateRequestDto';
import { TemplateCreateRequestDto } from '../@shared/dto/TemplateCreateRequestDto';
import { Mutex } from '../@shared/lib/Mutex';
import { isFile, pathExists } from '../@shared/lib/pathExists';
import { BibwatchService } from '../bibwatch/BibwatchService';
import { EventService } from '../event/EventService';
import { MediaService } from '../media/MediaService';

const TEMPLATE_ID = /^[A-Za-z0-9._ ()-]+$/;
const DESIGN_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];
const IMAGE_DATA_URL = /^data:image\/(png|jpe?g|webp);base64,(.*)$/s;

/** Bib templates: one JSON file per design in <media>/templates, made and calibrated by bibwatch. */
@Injectable()
export class TemplateService {
  /** Template files are rewritten by calibrate; one bibwatch template command at a time. */
  private readonly templateLock = new Mutex();

  constructor(
    private readonly bibwatchService: BibwatchService,
    private readonly eventService: EventService,
    private readonly mediaService: MediaService,
  ) {}

  get folder() {
    return path.join(this.mediaService.folder, 'templates');
  }

  /** Template id = file name without .json; only plain names inside media/templates. */
  pathOf(id: string) {
    if (!id || !TEMPLATE_ID.test(id) || id.startsWith('.')) {
      return null;
    }
    return path.join(this.folder, `${id}.json`);
  }

  async getTemplates() {
    await fs.mkdir(this.folder, { recursive: true });
    const templates = [];

    for (const name of (await fs.readdir(this.folder)).sort()) {
      if (!name.endsWith('.json')) {
        continue;
      }
      let template: Record<string, any>;
      try {
        template = JSON.parse(await fs.readFile(path.join(this.folder, name), 'utf8'));
      } catch {
        continue;
      }
      const id = name.slice(0, -'.json'.length);
      let image = null;
      for (const extension of DESIGN_EXTENSIONS) {
        if (await pathExists(path.join(this.folder, `${id}-design${extension}`))) {
          image = `/media/templates/${id}-design${extension}`;
          break;
        }
      }

      templates.push({
        id,
        name: template.name ?? id,
        hue: template.bandHue ?? null,
        calibrated: template.calibrated ?? 0,
        minBib: template.minBib || 1,
        maxBib: template.maxBib ?? null,
        image,
      });
    }

    return templates;
  }

  /** A new template from bib artwork (image sent as base64 data URL) or from a bib in the video. */
  async create(body: TemplateCreateRequestDto) {
    const name = (body.name ?? '').trim() || 'Bib';
    const baseId = name.replace(/[^A-Za-z0-9._ ()-]+/g, '-').replace(/^[-. ]+|[-. ]+$/g, '') || 'bib';
    await fs.mkdir(this.folder, { recursive: true });

    const digits = this.eventService.bibArgsOf(await this.eventService.getBibRules(), { withRange: false });
    const extra = ['--name', name, '--max-bib', String(body.maxBib || 250), ...digits];
    if (body.minBib) {
      extra.push('--min-bib', String(body.minBib));
    }

    const { id, outPath, result } = await this.templateLock.run(async () => {
      // Picked inside the lock so two templates with the same name get different ids.
      let id = baseId;
      for (let k = 2; await pathExists(this.pathOf(id)); k += 1) {
        id = `${baseId}-${k}`;
      }
      const outPath = this.pathOf(id);

      if (body.image) {
        const match = IMAGE_DATA_URL.exec(body.image);
        if (!match) {
          throw new BadRequestException({ error: 'send a PNG, JPEG or WebP image' });
        }
        const extension = match[1].startsWith('jp') ? '.jpg' : `.${match[1]}`;
        const imagePath = path.join(this.folder, `${id}-design${extension}`);
        await fs.writeFile(imagePath, Buffer.from(match[2], 'base64'));
        const result = await this.bibwatchService.run(['template', imagePath, outPath, ...extra]);
        return { id, outPath, result };
      }

      if (body.video && body.at) {
        const video = await this.mediaService.resolveVideo(body.video);
        const [t, x, y] = body.at;
        const result = await this.bibwatchService.run([
          'template', '--from-video', video, '--at', `${t},${x},${y}`, outPath, ...extra,
        ]);
        return { id, outPath, result };
      }

      throw new BadRequestException({ error: 'send an image or a video point' });
    });

    if (result.code !== 0 || !(await pathExists(outPath))) {
      const error = (result.stderr || result.stdout).trim().slice(-300) || 'could not make a template';
      throw new UnprocessableEntityException({ error });
    }

    return { id, message: result.stdout.trim(), templates: await this.getTemplates() };
  }

  async calibrate(body: TemplateCalibrateRequestDto) {
    const templatePath = this.pathOf(body.template);
    const video = this.mediaService.resolve(body.video);
    if (!templatePath || !(await pathExists(templatePath)) || !video || !(await isFile(video))) {
      throw new BadRequestException({ error: 'template, video and point needed' });
    }

    const [t, x, y] = body.at;
    const digits = this.eventService.bibArgsOf(await this.eventService.getBibRules(), { withRange: false });
    const result = await this.templateLock.run(() =>
      this.bibwatchService.run(['calibrate', templatePath, video, '--at', `${t},${x},${y}`, ...digits]),
    );
    if (result.code !== 0) {
      throw new UnprocessableEntityException({ error: (result.stderr || result.stdout).trim().slice(-300) });
    }

    return { message: result.stdout.trim(), templates: await this.getTemplates() };
  }

  async delete(id: string) {
    const templatePath = this.pathOf(id);
    if (!templatePath || !(await pathExists(templatePath))) {
      throw new NotFoundException({ error: 'no such template' });
    }
    await fs.rm(templatePath);

    return { templates: await this.getTemplates() };
  }

  /** What the chosen templates find in one frame (the viewer's "bib finder" overlay). */
  async find(query: FinderQueryDto) {
    const video = this.mediaService.resolve(query.video);
    const templatePaths = query.templateIds.map((id) => this.pathOf(id));
    const allExist = await Promise.all(templatePaths.map((p) => p && pathExists(p)));
    if (!video || !(await isFile(video)) || !templatePaths.length || !allExist.every(Boolean)) {
      throw new BadRequestException({ error: 'video or templates missing' });
    }

    const args = ['finder', video, '--at', query.t, ...this.eventService.bibArgsOf(await this.eventService.getBibRules(), { withRange: false })];
    for (const templatePath of templatePaths) {
      args.push('--template', templatePath);
    }
    const result = await this.bibwatchService.run(args, 30_000);
    if (result.code !== 0) {
      throw new InternalServerErrorException({ error: (result.stderr || result.stdout).slice(-300) });
    }

    return JSON.parse(result.stdout);
  }
}
