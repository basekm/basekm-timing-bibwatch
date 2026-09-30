import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import * as fs from 'fs/promises';
import * as path from 'path';

import { Repository } from 'typeorm';

import { EventSettingsRequestDto } from '../@shared/dto/EventSettingsRequestDto';
import { EventSettingsEntity } from '../@shared/entities/EventSettingsEntity';
import { ConfigService } from '../config/ConfigService';

const ROW = 1;

/** Bib rules as a scan uses them: always complete, with the ranges worked out. */
export type BibRules = { minDigits: number; maxDigits: number; minBib: number; maxBib: number };

@Injectable()
export class EventService {
  constructor(
    @InjectRepository(EventSettingsEntity)
    private readonly eventSettingsRepository: Repository<EventSettingsEntity>,
    private readonly configService: ConfigService,
  ) {}

  private get registeredFile() {
    return path.join(this.configService.MediaFolder, 'registered.txt');
  }

  async getSettings() {
    const saved = await this.eventSettingsRepository.findOneBy({ id: ROW });
    const registered = await this.readRegistered();
    return {
      minDigits: saved?.minDigits ?? 4,
      maxDigits: saved?.maxDigits ?? 4,
      minBib: saved?.minBib ?? null,
      maxBib: saved?.maxBib ?? null,
      registered: { file: this.registeredFile, count: registered.length, highest: registered.length ? Math.max(...registered) : null },
    };
  }

  async saveSettings(body: EventSettingsRequestDto) {
    await this.eventSettingsRepository.save({
      id: ROW, minDigits: body.minDigits, maxDigits: body.maxDigits, minBib: body.minBib, maxBib: body.maxBib,
    });
    return this.getSettings();
  }

  /**
   * The rules a scan runs with. Highest bib: as set, else the highest registered bib, else the
   * largest number with the most digits (4 digits: 9999).
   */
  async getBibRules(): Promise<BibRules> {
    const s = await this.getSettings();
    return {
      minDigits: s.minDigits,
      maxDigits: s.maxDigits,
      minBib: s.minBib ?? 1,
      maxBib: s.maxBib ?? s.registered.highest ?? 10 ** s.maxDigits - 1,
    };
  }

  /** Scanner options for these rules (the classic 4 digits adds no --digits, so earlier scans stay reusable). */
  bibArgsOf(rules: BibRules) {
    const args = rules.minDigits === 4 && rules.maxDigits === 4 ? [] : ['--digits', `${rules.minDigits}-${rules.maxDigits}`];
    args.push('--max-bib', String(rules.maxBib));
    if (rules.minBib > 1) {
      args.push('--min-bib', String(rules.minBib));
    }
    return args;
  }

  private async readRegistered() {
    const text = await fs.readFile(this.registeredFile, 'utf8').catch(() => '');
    return text.split(/[\s,]+/).map(Number).filter((n) => Number.isInteger(n) && n > 0);
  }
}
