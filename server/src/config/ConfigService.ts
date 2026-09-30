import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

import * as fs from 'fs';
import * as path from 'path';

// The repo root holds Package.swift; found by walking up so it works from src/ (tests) and dist/.
const findRepoFolder = () => {
  let dir = __dirname;
  while (!fs.existsSync(path.join(dir, 'Package.swift'))) {
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error('bibwatch repo not found: no Package.swift above the server');
    }
    dir = parent;
  }
  return dir;
};

const REPO_FOLDER = findRepoFolder();

@Injectable()
export class ConfigService {
  constructor(private nestConfigService: NestConfigService) {}

  get Port() {
    return Number(this.nestConfigService.get<string>('PORT') || 8765);
  }

  get MediaFolder() {
    const folder = this.nestConfigService.get<string>('MEDIA_FOLDER');
    return folder ? path.resolve(folder) : null;
  }

  /** Defaults to <media>/bibwatch.sqlite: the sightings and tags travel with the videos they describe. */
  get DatabaseSQLiteFile() {
    const file = this.nestConfigService.get<string>('DATABASE_SQLITE_FILE');
    if (file) {
      return path.resolve(file);
    }
    return this.MediaFolder ? path.join(this.MediaFolder, 'bibwatch.sqlite') : null;
  }

  get RepoFolder() {
    return REPO_FOLDER;
  }

  get BibwatchBinary() {
    return path.join(REPO_FOLDER, '.build', 'release', 'bibwatch');
  }
}
