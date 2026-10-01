import * as fs from 'fs/promises';
import * as path from 'path';
import * as readline from 'readline';

import { RunningScanStates, ScanState, ScanStateId } from '../@shared/constants/ScanStateId';
import { pathExists } from '../@shared/lib/pathExists';
import { BibwatchService } from '../bibwatch/BibwatchService';

export type ScanJobOptions = {
  videoPath: string;
  /** Segments from the viewer; null = reuse segments.json, or find them first. */
  segments: object | null;
  clock: string | null;
  targetsPath: string | null;
  registeredPath: string | null;
  /** The event's bib rules as scanner options (digits and number range). */
  bibArgs: string[];
  /** Read bibs only on people's torsos (experimental). */
  peopleFirst: boolean;
  startAt: number | null;
};

/** One run of `bibwatch segments` (if needed) + `bibwatch scan`, followed through its JSON progress lines. */
export class ScanJob {
  state: ScanState = ScanStateId.Starting;
  phase: string | null = null; // segments | coarse | fine
  done = 0;
  total = 0;
  eta: number | null = null;
  at: number | null = null; // video time being read now
  message = '';
  summary = '';
  checkpoints = 0;

  private readonly started = Date.now();
  private proc: ReturnType<BibwatchService['spawn']> | null = null;

  constructor(
    readonly video: string,
    private readonly folder: string,
    private readonly folderUrl: string,
    private readonly bibwatchService: BibwatchService,
  ) {}

  /** A getter so the check after each `await` sees a cancel() that happened meanwhile. */
  get isCancelled() {
    return this.state === ScanStateId.Cancelled;
  }

  get isRunning() {
    return RunningScanStates.includes(this.state);
  }

  async getStatus() {
    const detectionsPath = path.join(this.folder, 'detections.json');
    const detections = await fs.stat(detectionsPath).catch(() => null);
    const detectionsUrl = `${this.folderUrl}/detections.json`;

    return {
      checkpoint: detections ? detections.mtimeMs / 1000 : null,
      partial: detections ? detectionsUrl : null,
      video: this.video,
      state: this.state,
      phase: this.phase,
      done: this.done,
      total: this.total,
      eta: this.eta,
      at: this.at,
      message: this.message,
      summary: this.summary,
      elapsed: Math.round((Date.now() - this.started) / 1000),
      result: this.state === ScanStateId.Done ? detectionsUrl : null,
    };
  }

  /** Runs to the end; never throws (failures land in `state` / `message` for the viewer). */
  async run(options: ScanJobOptions) {
    try {
      await fs.mkdir(this.folder, { recursive: true });
      const segmentsPath = path.join(this.folder, 'segments.json');

      if (options.segments) {
        await fs.writeFile(segmentsPath, JSON.stringify(options.segments, null, 1));
      } else if (!(await pathExists(segmentsPath))) {
        this.state = ScanStateId.Segments;
        const { code, stdout } = await this.runStep([
          'segments', options.videoPath, segmentsPath, '--progress', 'json',
        ]);
        if (this.isCancelled) {
          return;
        }
        if (code !== 0) {
          this.fail((stdout || this.message).slice(-500));
          return;
        }
      }

      this.state = ScanStateId.Scanning;
      const args = ['scan', options.videoPath, this.folder, '--segments', segmentsPath, '--progress', 'json'];
      if (options.clock) {
        args.push('--clock', options.clock);
      }
      if (options.targetsPath) {
        args.push('--targets', options.targetsPath);
      }
      if (options.registeredPath) {
        args.push('--registered', options.registeredPath);
      }
      // Accept any bib design: the scanner's colour check only knows one (white digits on
      // magenta) and rejects every other race's bibs.
      args.push('--no-color');
      args.push(...options.bibArgs);
      if (options.peopleFirst) {
        args.push('--people-first');
      }
      if (options.startAt) {
        args.push('--from', String(options.startAt));
      }

      const { code, stdout } = await this.runStep(args);
      if (this.isCancelled) {
        return;
      }
      this.summary = stdout.trim();
      if (code !== 0) {
        this.fail((stdout || this.message).slice(-500));
        return;
      }
      this.state = ScanStateId.Done;
    } catch (error) {
      this.fail(String(error?.message ?? error));
    }
  }

  cancel() {
    // SIGTERM: the scanner saves everything read so far before exiting.
    this.state = ScanStateId.Cancelled;
    if (this.proc && this.proc.exitCode === null) {
      this.proc.kill('SIGTERM');
    }
  }

  fail(message: string) {
    this.state = ScanStateId.Failed;
    this.message = message;
  }

  /** Runs one bibwatch command, following its JSON progress lines on stderr. */
  private runStep(args: string[]) {
    return new Promise<{ code: number; stdout: string }>((resolve, reject) => {
      const proc = this.bibwatchService.spawn(args);
      this.proc = proc;

      // Both pipes are drained as data arrives, so a chatty stdout can never fill up and stall the scanner.
      let stdout = '';
      proc.stdout.setEncoding('utf8');
      proc.stdout.on('data', (chunk: string) => {
        stdout += chunk;
      });
      readline
        .createInterface({ input: proc.stderr })
        .on('line', (line) => this.onProgressLine(line.trim()));

      proc.on('error', reject);
      proc.on('close', (code) => resolve({ code: code ?? -1, stdout }));
    });
  }

  private onProgressLine(line: string) {
    if (!line.startsWith('{')) {
      if (line) {
        this.message = line;
      }
      return;
    }

    let progress: Record<string, any>;
    try {
      progress = JSON.parse(line);
    } catch {
      return;
    }

    if (progress.phase === 'checkpoint') {
      this.checkpoints += 1; // a progress save landed; the viewer reloads it
      return;
    }
    this.phase = progress.phase ?? null;
    this.done = progress.done ?? 0;
    this.total = progress.total ?? 0;
    this.eta = progress.eta ?? null;
    this.at = progress.at ?? this.at;
  }
}
