// The viewer re-decides sightings in TypeScript (web/src/@shared/utils/decideSightings.ts)
// whenever mats or segments change; this checks it agrees with the scanner (Scan.swift) on
// every benchmark scan. Run by bench/run.sh; needs web/node_modules.
import { createJiti } from '../web/node_modules/jiti/lib/jiti.mjs';
import fs from 'node:fs';
const root = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const jiti = createJiti(import.meta.url, { alias: { '@basekm/dtos': root + '/web/src/@shared/dtos' } });
const { decideSightings } = await jiti.import(root + '/web/src/@shared/utils/decideSightings.ts');
let bad = 0;
for (const name of ['trim-whole', 'trim-people', 'gx-whole', 'gx-people']) {
  const d = JSON.parse(fs.readFileSync(`${root}/out/bench-score/${name}/detections.json`, 'utf8'));
  const ts = decideSightings({ coarseHits: d.coarseHits, segments: d.segments, frames: d.frames, targets: new Set(d.targets ?? []), settings: d.settings });
  const key = (s) => `${s.bib}@${s.from}`;
  const swift = new Map(d.sightings.map((s) => [key(s), s]));
  let diffs = 0;
  for (const s of ts) {
    const w = swift.get(key(s));
    if (!w || w.label !== s.label || (s.label === 'duplicate' && w.note !== s.note)) { diffs++; if (diffs <= 5) console.log('  diff', name, key(s), s.label, s.note, '| swift:', w?.label, w?.note); }
  }
  console.log(name, 'sightings', ts.length, 'vs', d.sightings.length, 'label differences', diffs);
  bad += diffs + Math.abs(ts.length - d.sightings.length);
}
process.exit(bad ? 1 : 0);
