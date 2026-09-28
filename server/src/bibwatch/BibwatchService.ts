import { Injectable } from '@nestjs/common';

import { ChildProcessByStdio, execFile, spawn } from 'child_process';
import { Readable } from 'stream';

import { pathExists } from '../@shared/lib/pathExists';
import { ConfigService } from '../config/ConfigService';

export type BibwatchResult = {
  code: number;
  stdout: string;
  stderr: string;
};

/** Runs the Swift `bibwatch` binary. Always async: a 2-minute calibrate must never stall video serving. */
@Injectable()
export class BibwatchService {
  constructor(private readonly configService: ConfigService) {}

  isBuilt() {
    return pathExists(this.configService.BibwatchBinary);
  }

  /** Runs one command to completion, collecting its output. */
  run(args: string[], timeoutMs = 120_000): Promise<BibwatchResult> {
    return new Promise((resolve) => {
      execFile(
        this.configService.BibwatchBinary,
        args,
        { timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 },
        (error, stdout, stderr) => {
          if (!error) {
            return resolve({ code: 0, stdout, stderr });
          }

          const code = typeof error.code === 'number' ? error.code : -1;
          const reason = error.killed ? `timed out after ${timeoutMs / 1000} s` : error.message;

          resolve({ code, stdout, stderr: stderr || reason });
        },
      );
    });
  }

  /** Starts a long command (scan, segments) whose progress the caller follows on stderr. */
  spawn(args: string[]): ChildProcessByStdio<null, Readable, Readable> {
    return spawn(this.configService.BibwatchBinary, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  }
}
