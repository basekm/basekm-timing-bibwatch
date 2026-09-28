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

  get RepoFolder() {
    return REPO_FOLDER;
  }

  get ViewerFolder() {
    return path.join(REPO_FOLDER, 'viewer');
  }

  get BibwatchBinary() {
    return path.join(REPO_FOLDER, '.build', 'release', 'bibwatch');
  }
}
