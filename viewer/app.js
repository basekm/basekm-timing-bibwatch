// bibwatch viewer — plays a race video with the scanner's detections drawn on top.
// Everything stays in this browser tab: files are opened from disk, nothing is uploaded.
'use strict';

const $ = (id) => document.getElementById(id);
const video = $('video');
const canvas = $('overlay');
const ctx = canvas.getContext('2d');

const state = {
  videoName: null,
  data: null,          // detections.json (or a segments.json wrapped as detections)
  frames: [],          // overlay frames sorted by t
  segments: [],
  sightings: [],
  crossedBibs: new Set(),
  clockOffset: null,   // reader seconds at video 0:00
  filter: 'all',
  search: '',
  marking: null,       // null | [] | [{x,y}]
  mediaVideo: null,    // path of the video inside the server's media folder (enables Run scan)
  server: null,        // /api/media response when served by the local server (server/)
  targets: new Set(),
  needsScan: 0,
  templates: [],       // bib templates available on the server
  useTemplates: new Set(JSON.parse(localStorage.getItem('bibwatch.templates') || '[]')),
  picking: null,       // { mode: 'calibrate' | 'new', template?, name?, … } — next click on the video
  finder: null,        // { t, candidates, reads } from the server for the paused frame
  tags: {},            // sighting key → [your tags]
  selected: null,      // sighting key the tag bar is editing
  tagFilter: '',
};

// ---------- time helpers ----------
function parseClock(s) {
  const parts = String(s).trim().split(':').map(Number);
  if (parts.some(Number.isNaN)) return null;
  return parts.reduce((acc, v) => acc * 60 + v, 0);
}
function fmt(t, tenths = true) {
  if (t == null || Number.isNaN(t)) return '—';
  const neg = t < 0; t = Math.abs(t);
  const whole = Math.floor(t);
  const h = Math.floor(whole / 3600), m = Math.floor(whole / 60) % 60, s = whole % 60;
  const base = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return (neg ? '-' : '') + (tenths ? `${base}.${Math.floor((t - whole) * 10)}` : base);
}
const reader = (t) => (state.clockOffset == null ? null : state.clockOffset + t);

// ---------- loading ----------
function setStatus(msg) { $('status').textContent = msg; }

// In-page replacements for alert / confirm / prompt (blocked in the built-in browser).
function uiAsk({ message, input = null, okText = 'OK', cancelText = 'Cancel' }) {
  const dlg = $('uiDialog');
  $('uiMessage').textContent = message;
  const inp = $('uiInput');
  inp.hidden = input == null;
  inp.value = input ?? '';
  $('uiOk').textContent = okText;
  $('uiCancel').hidden = cancelText == null;
  $('uiCancel').textContent = cancelText || '';
  dlg.returnValue = 'cancel';
  dlg.showModal();
  if (input != null) { inp.focus(); inp.select(); }
  return new Promise((resolve) => {
    dlg.addEventListener('close', () => resolve(dlg.returnValue === 'ok' ? (input != null ? inp.value : true) : (input != null ? null : false)), { once: true });
  });
}
$('uiInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('uiDialog').close('ok'); } });
const uiAlert = (message) => uiAsk({ message, cancelText: null });
const uiConfirm = (message, okText = 'OK') => uiAsk({ message, okText });
const uiPrompt = (message, value = '') => uiAsk({ message, input: value });

function loadVideo(src, name) {
  state.videoName = name;
  state.mediaVideo = src.startsWith('/media/') ? decodeURIComponent(src.slice('/media/'.length)) : null;
  video.src = src;
  updateScanUI();
  const saved = localStorage.getItem(`bibwatch.clock.${name}`);
  if (saved != null) state.clockOffset = Number(saved);
  setStatus(`Video: ${name}` + (state.data ? ` · ${state.data.video || ''}` : ''));
}

function loadData(json) {
  // Accept detections.json or a bare segments.json from `bibwatch segments`.
  const d = json.frames ? json : { video: json.video, duration: json.duration, segments: json.segments, frames: [], sightings: [], clock: null };
  state.data = d;
  state.frames = (d.frames || []).slice().sort((a, b) => a.t - b.t);
  state.segments = d.segments || [];
  state.sightings = (d.sightings || []).slice().sort((a, b) => (a.cross ?? a.from) - (b.cross ?? b.from));
  state.crossedBibs = new Set(state.sightings.filter((s) => s.label === 'crossed').map((s) => s.bib));
  state.targets = new Set(d.targets || state.sightings.filter((s) => s.target).map((s) => s.bib));
  if (d.clock && state.clockOffset == null) state.clockOffset = parseClock(d.clock);
  // Scans from the accumulating scanner carry the raw reads: decide crossings here, so the
  // current mats and segment edits always apply.
  if (d.coarseHits) resync(false);
  if (state.videoName && d.video && d.video !== state.videoName) {
    setStatus(`⚠️ Detections are for ${d.video}, but the video is ${state.videoName}`);
  } else {
    setStatus(`${d.video || 'data'} · ${state.segments.length} segment(s) · ${state.sightings.length} sighting(s) · ${state.frames.length} annotated frames`);
  }
  renderList();
  renderTimeline();
  draw();
}

function readFile(file) {
  if (!file) return;
  if (file.type.startsWith('video/') || /\.(mp4|mov|m4v)$/i.test(file.name)) {
    loadVideo(URL.createObjectURL(file), file.name);
  } else {
    file.text().then((txt) => {
      try { loadData(JSON.parse(txt)); } catch (e) { setStatus(`Could not read ${file.name}: ${e.message}`); }
    });
  }
}

$('videoFile').addEventListener('change', (e) => readFile(e.target.files[0]));
$('dataFile').addEventListener('change', (e) => readFile(e.target.files[0]));
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => { e.preventDefault(); [...e.dataTransfer.files].forEach(readFile); });

// Optional: ?video=URL&data=URL when served by the local server (server/). Runs once the whole script has
// loaded (queued), because loading uses helpers defined further down.
queueMicrotask(function fromQuery() {
  const q = new URLSearchParams(location.search);
  if (q.get('video')) loadVideo(q.get('video'), decodeURIComponent(q.get('video').split('/').pop()));
  if (q.get('data')) fetch(q.get('data')).then((r) => r.json()).then(loadData).catch((e) => setStatus(`data: ${e.message}`));
});

// ---------- decisions (mirror of Sources/bibwatch/Scan.swift: buildWindows / evaluate) ----------
// Reading bibs and people is slow and done once by the scanner; deciding crossed / viewed /
// passing from those reads is fast, so the viewer redoes it whenever mats or segments change.
function matY(mat, x) {
  if (mat.x1 === mat.x0) return (mat.y0 + mat.y1) / 2;
  const f = Math.min(Math.max((x - mat.x0) / (mat.x1 - mat.x0), 0), 1);
  return mat.y0 + (mat.y1 - mat.y0) * f;
}
const cxOf = (b) => (b[0] + b[2]) / 2, cyOf = (b) => (b[1] + b[3]) / 2, areaOf = (b) => (b[2] - b[0]) * (b[3] - b[1]);
const inBox = (b, x, y) => x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3];

function segmentFor(t, segments) { return segments.find((s) => t >= s.from && t < s.to) || segments[segments.length - 1]; }

function buildWindows(hits, segments) {
  const out = [];
  for (const [bib, ts] of Object.entries(hits)) {
    let cur = null;
    for (const x of [...ts].sort((a, b) => a - b)) {
      const seg = segmentFor(x, segments);
      if (cur && x - cur.to <= 10 && cur.seg.index === seg.index) { cur.to = x; cur.count += 1; continue; }
      if (cur) out.push(cur);
      cur = { bib, from: x, to: x, count: 1, seg };
    }
    if (cur) out.push(cur);
  }
  return out.sort((a, b) => a.from - b.from);
}

function framesBetween(lo, hi) {
  const f = state.frames;
  let a = 0, b = f.length;
  while (a < b) { const m = (a + b) >> 1; if (f[m].t < lo - 1e-6) a = m + 1; else b = m; }
  const out = [];
  for (let i = a; i < f.length && f[i].t <= hi + 1e-6; i++) if (f[i].people) out.push(f[i]);
  return out;
}

function evaluate(w, pad, fineFps) {
  const s = { bib: w.bib, target: state.targets.has(w.bib), segment: w.seg.index, from: w.from, to: w.to,
    coarseFrames: w.count, label: 'viewed', cross: null, reads: 0, fullReads: 0, tracked: 0, note: '', zone: null, direction: null };
  if (w.seg.kind !== 'fixed') { s.label = 'camera-moving'; s.note = 'camera was being moved'; return s; }
  const mat = w.seg.mat;
  const lo = Math.max(w.seg.from, w.from - pad), hi = Math.min(w.seg.to, w.to + pad);
  const frames = framesBetween(lo, hi);
  const designs = {};
  frames.forEach((f) => f.bibs.forEach((b) => { if (b.bib === w.bib && b.template) designs[b.template] = (designs[b.template] || 0) + 1; }));
  s.template = Object.keys(designs).sort((a, b) => designs[b] - designs[a])[0] || null;
  const expected = Math.max(1, Math.floor((hi - lo) * fineFps));
  if (frames.length < 0.8 * expected) { s.label = 'needs-scan'; s.note = 'not enough frames read here yet — run the scan'; return s; }

  const person = new Map();   // frame index → { box, read }
  frames.forEach((fr, k) => {
    const hit = fr.bibs.find((b) => b.bib === w.bib);
    if (!hit) return;
    s.reads += 1;
    if (!hit.fragment) s.fullReads += 1;
    const around = fr.people.filter((p) => inBox(p, cxOf(hit.box), cyOf(hit.box)));
    if (around.length) person.set(k, { box: around.reduce((a, b) => (areaOf(b) < areaOf(a) ? b : a)), read: true });
  });
  const follow = (order) => {
    let last = null;
    for (const k of order) {
      const p0 = person.get(k);
      if (p0 && p0.read) { last = p0.box; continue; }
      if (!last) continue;
      const d = (p) => Math.hypot(cxOf(p) - cxOf(last), p[3] - last[3]);
      const best = frames[k].people.reduce((a, b) => (a == null || d(b) < d(a) ? b : a), null);
      if (best && d(best) < 0.10) { if (!person.has(k)) person.set(k, { box: best, read: false }); last = best; } else last = null;
    }
  };
  const idx = frames.map((_, k) => k);
  follow(idx); follow([...idx].reverse());
  const keys = [...person.keys()].sort((a, b) => a - b);
  s.tracked = keys.length;
  if (s.reads === 0 || ![...person.values()].some((p) => p.read)) { s.label = 'viewed'; s.note = 'bib read, but no person found around it'; return s; }
  // Direction: feet moving down the frame (toward the camera), up, or staying put.
  const feet = keys.map((k) => person.get(k).box[3]);
  const q = Math.max(1, Math.floor(feet.length / 4));
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const trend = avg(feet.slice(-q)) - avg(feet.slice(0, q));
  s.direction = trend > 0.03 ? 'toward' : trend < -0.03 ? 'away' : 'still';

  if (!mat) { s.label = 'viewed'; s.note = 'no mat marked for this camera position'; return s; }
  const track = keys.map((k) => {
    const b = person.get(k).box;
    return { t: frames[k].t, x: cxOf(b), depth: b[3] - matY(mat, cxOf(b)) };
  });
  // Zone: typical position while the bib was readable.
  const readDepths = keys.filter((k) => person.get(k).read).map((k) => { const b = person.get(k).box; return b[3] - matY(mat, cxOf(b)); }).sort((a, b) => a - b);
  if (readDepths.length) {
    const d = readDepths[Math.floor(readDepths.length / 2)];
    s.zone = d < -0.25 ? 'background' : d < -0.04 ? 'before-mat' : d <= 0.02 ? 'on-mat' : 'past-mat';
  }

  const minX = Math.min(mat.x0, mat.x1), maxX = Math.max(mat.x0, mat.x1);
  let sawBefore = false;
  for (let k = 0; k < track.length; k++) {
    const p = track[k];
    if (p.depth < -0.04) sawBefore = true;
    if (sawBefore && k > 0 && p.depth >= 0 && p.x >= minX - 0.02 && p.x <= maxX + 0.02) {
      const q = track[k - 1];
      const f = (0 - q.depth) / Math.max(p.depth - q.depth, 1e-6);
      s.cross = q.t + (p.t - q.t) * Math.min(Math.max(f, 0), 1);
      break;
    }
  }
  const near = track.filter((p) => p.depth >= -0.06);
  const nearSpan = near.length ? Math.max(...near.map((p) => p.t)) - Math.min(...near.map((p) => p.t)) : 0;
  const deepest = track.length ? Math.max(...track.map((p) => p.depth)) : -1;
  if (s.cross != null) { s.label = 'crossed'; if (nearSpan > 5) s.note = 'stayed near the mat afterwards'; }
  else if (near.length && nearSpan >= 2) { s.label = 'near-mat'; s.note = 'on or near the mat without a clear crossing'; }
  else if (deepest < -0.06) { s.label = 'passing'; s.note = 'never came close to the mat'; }
  else if (track.length < 4) s.note = 'too few tracked frames';
  return s;
}

// One crossing = one bib (mirror of oneBibPerCrossing in Scan.swift): sightings crossing within
// a second of each other are one runner read several ways — keep the one with the most
// full-number reads (then most reads), mark the rest as duplicates.
function oneBibPerCrossing(list) {
  const crossed = list.filter((s) => s.label === 'crossed' && s.cross != null).sort((a, b) => a.cross - b.cross);
  for (let i = 0; i < crossed.length;) {
    const group = [crossed[i]];
    while (i + group.length < crossed.length && crossed[i + group.length].cross - group[group.length - 1].cross <= 1.0) group.push(crossed[i + group.length]);
    if (group.length > 1) {
      const fr = (x) => x.fullReads ?? 0;
      const keep = group.reduce((a, b) => (fr(b) > fr(a) || (fr(b) === fr(a) && b.reads > a.reads) ? b : a));
      for (const g of group) if (g !== keep) { g.label = 'duplicate'; g.note = `same crossing as ${keep.bib} (read as ${g.bib})`; }
    }
    i += group.length;
  }
  return list;
}

// Re-decide every sighting from the reads we already have (instant). Returns how many
// sightings still need frames that haven't been read.
function resync(announce = true) {
  const d = state.data;
  if (!d || !d.coarseHits || !state.segments.length) return 0;
  const st = d.settings || { pad: 4, fineFps: 10 };
  state.sightings = oneBibPerCrossing(buildWindows(d.coarseHits, state.segments).map((w) => evaluate(w, st.pad, st.fineFps)))
    .sort((a, b) => (a.cross ?? a.from) - (b.cross ?? b.from));
  state.crossedBibs = new Set(state.sightings.filter((s) => s.label === 'crossed').map((s) => s.bib));
  state.needsScan = state.sightings.filter((s) => s.label === 'needs-scan').length;
  renderList(); renderTimeline(); updateScanUI(); refreshTagFilter(); renderTagBar();
  if (announce) {
    const crossed = state.sightings.filter((s) => s.label === 'crossed').length;
    setStatus(`Re-synced: ${state.sightings.length} sightings, ${crossed} crossed` +
      (state.needsScan ? ` · ${state.needsScan} need frames that haven't been read yet — press Run scan` : ''));
  }
  return state.needsScan;
}

// ---------- geometry: where the picture actually sits inside the <video> box ----------
function contentRect() {
  const cw = canvas.clientWidth, ch = canvas.clientHeight;
  const vw = video.videoWidth || 16, vh = video.videoHeight || 9;
  const scale = Math.min(cw / vw, ch / vh);
  const w = vw * scale, h = vh * scale;
  return { x: (cw - w) / 2, y: (ch - h) / 2, w, h };
}
const toPx = (r, fx, fy) => [r.x + fx * r.w, r.y + fy * r.h];

// ---------- lookups ----------
function nearestFrame(t) {
  const f = state.frames;
  if (!f.length) return null;
  let lo = 0, hi = f.length - 1;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (f[mid].t < t) lo = mid + 1; else hi = mid; }
  const cands = [f[lo], f[lo - 1]].filter(Boolean);
  const best = cands.reduce((a, b) => (Math.abs(a.t - t) <= Math.abs(b.t - t) ? a : b));
  const tolerance = best.people ? 0.15 : 0.35; // fine frames are 0.1 s apart, coarse 0.5 s
  return Math.abs(best.t - t) <= tolerance ? best : null;
}
const segmentAt = (t) => state.segments.find((s) => t >= s.from && t < s.to) || state.segments[state.segments.length - 1] || null;

// ---------- drawing ----------
function draw() {
  const dpr = window.devicePixelRatio || 1;
  const cw = canvas.clientWidth, ch = canvas.clientHeight;
  if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cw, ch);
  const r = contentRect();
  const t = video.currentTime || 0;
  const seg = segmentAt(t);

  // Mat line for this camera position.
  if (seg && seg.kind === 'fixed' && seg.mat) {
    const [x0, y0] = toPx(r, seg.mat.x0, seg.mat.y0), [x1, y1] = toPx(r, seg.mat.x1, seg.mat.y1);
    ctx.save(); ctx.setLineDash([12, 8]); ctx.lineWidth = 3; ctx.strokeStyle = '#ffd60a';
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.restore();
  }

  // People and bibs from the nearest scanned frame.
  const f = nearestFrame(t);
  if (f) {
    if (f.people && $('showPeople').checked) {
      ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      for (const p of f.people) { const [a, b] = toPx(r, p[0], p[1]), [c, d] = toPx(r, p[2], p[3]); ctx.strokeRect(a, b, c - a, d - b); }
    }
    for (const b of f.bibs) {
      const target = state.sightings.some((s) => s.bib === b.bib && s.target);
      const crossed = state.crossedBibs.has(b.bib);
      if (!$('showAll').checked && !target && !crossed) continue;
      const color = target ? '#ff453a' : crossed ? '#34c759' : '#4f9cf9';
      const [a, bb] = toPx(r, b.box[0], b.box[1]), [c, d] = toPx(r, b.box[2], b.box[3]);
      ctx.lineWidth = 3; ctx.strokeStyle = color; ctx.strokeRect(a - 4, bb - 4, c - a + 8, d - bb + 8);
      tag(`${b.bib}${b.confidence < 0.5 ? ' ?' : ''}`, a - 4, bb - 8, color);
    }
  }

  // Crossing flash: show for a moment after a runner crosses.
  const flashing = state.sightings.filter((s) => s.cross != null && t >= s.cross - 0.2 && t <= s.cross + 1.5);
  flashing.forEach((s, i) => {
    const text = `${s.bib} CROSSED  ${fmt(s.cross)}${reader(s.cross) != null ? '  ·  ' + fmt(reader(s.cross)) : ''}`;
    banner(text, r.x + r.w / 2, r.y + 100 + i * 34, s.target ? '#ff453a' : '#34c759');
  });

  // While swiping, show where you are in big type (the picture may lag a frame or two).
  if (state.swipeFlashUntil && performance.now() < state.swipeFlashUntil) {
    const st = scrub.previewTime ?? t;
    banner(`⟷  ${fmt(st)}${reader(st) != null ? '   ·   ' + fmt(reader(st)) : ''}`, r.x + r.w / 2, r.y + r.h / 2, 'rgba(0,0,0,0.75)');
  }

  // Running clock and segment state.
  const clockText = `▶ ${fmt(t)}` + (reader(t) != null ? `   reader ${fmt(reader(t))}` : '   reader: set clock');
  tag(clockText, r.x + 10, r.y + 30, 'rgba(0,0,0,0.7)', 18);
  if (seg && seg.kind === 'moving') banner('CAMERA MOVING — crossings not counted', r.x + r.w / 2, r.y + 60, '#ff9f0a');
  else if (seg && !seg.mat) banner('Mat not marked for this camera position — press M', r.x + r.w / 2, r.y + 60, '#9aa0a6');

  // What the templates find in this (paused) frame.
  if ($('showFinder').checked && state.finder && Math.abs(state.finder.t - t) < 0.05) {
    ctx.save(); ctx.setLineDash([6, 4]); ctx.lineWidth = 2;
    for (const c of state.finder.candidates) {
      const tpl = state.templates.find((x) => x.name === c.template);
      ctx.strokeStyle = tpl ? `hsl(${tpl.hue}, 90%, 60%)` : '#ffd60a';
      const [a, b] = toPx(r, c.box[0], c.box[1]), [c2, d] = toPx(r, c.box[2], c.box[3]);
      ctx.strokeRect(a, b, c2 - a, d - b);
    }
    ctx.restore();
    for (const rd of state.finder.reads) {
      const [a, b] = toPx(r, rd.box[0], rd.box[1]);
      tag(`${rd.bib} · ${rd.template}`, a, b - 6, 'rgba(0,0,0,0.75)', 12);
    }
    tag(`templates: ${state.finder.candidates.length} area(s), ${state.finder.reads.length} read · ${state.finder.ms} ms`, r.x + 10, r.y + r.h - 12, 'rgba(0,0,0,0.6)', 12);
  }
  if (state.picking) {
    banner(state.picking.mode === 'new' ? 'Click the number of a clear bib of the new design' : `Click the number of a clear ${state.picking.name} bib (Esc when done)`, r.x + r.w / 2, r.y + 60, '#ffd60a');
  }

  // Mat marking in progress.
  if (state.marking) {
    banner(state.marking.length ? 'Click the other end of the mat edge' : 'Click one end of the mat’s near edge', r.x + r.w / 2, r.y + 60, '#ffd60a');
    for (const p of state.marking) { const [x, y] = toPx(r, p.x, p.y); ctx.fillStyle = '#ffd60a'; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill(); }
  }

  updateSide(t, seg);
}

function tag(text, x, y, bg, size = 14) {
  ctx.font = `600 ${size}px -apple-system, sans-serif`;
  const w = ctx.measureText(text).width + 10;
  ctx.fillStyle = bg; ctx.fillRect(x, y - size - 4, w, size + 8);
  ctx.fillStyle = '#fff'; ctx.fillText(text, x + 5, y);
}
function banner(text, cx, y, bg) {
  ctx.font = '700 18px -apple-system, sans-serif';
  const w = ctx.measureText(text).width + 24;
  ctx.fillStyle = bg; ctx.fillRect(cx - w / 2, y - 22, w, 30);
  ctx.fillStyle = bg === '#ffd60a' || bg === '#ff9f0a' ? '#000' : '#fff';
  ctx.fillText(text, cx - w / 2 + 12, y);
}

// ---------- side panel ----------
let lastListKey = '';
function updateSide(t, seg) {
  $('videoTime').textContent = fmt(t);
  $('readerTime').textContent = reader(t) != null ? fmt(reader(t)) : 'set clock';
  $('segmentInfo').textContent = seg ? `Segment #${seg.index} · ${seg.kind}${seg.kind === 'fixed' ? (seg.mat ? ' · mat marked' : ' · mat not marked') : ''} · ${fmt(seg.from, false)}–${fmt(seg.to, false)}` : '';
  // Highlight sightings around the current time.
  const key = Math.floor(t * 2);
  if (key === lastListKey) return;
  lastListKey = key;
  document.querySelectorAll('#list li[data-i]').forEach((li) => {
    const s = state.sightings[li.dataset.i];
    li.classList.toggle('current', t >= s.from - 4 && t <= s.to + 4);
  });
}

function visible(s) {
  if (state.search && !s.bib.includes(state.search)) return false;
  if (state.tagFilter && !allTags(s).includes(state.tagFilter)) return false;
  if (state.filter === 'crossed') return labelOf(s) === 'crossed';
  if (state.filter === 'targets') return s.target;
  if (state.filter === 'other') return labelOf(s) !== 'crossed';
  return true;
}

function renderList() {
  const list = $('list');
  list.innerHTML = '';
  state.sightings.forEach((s, i) => {
    if (!visible(s)) return;
    const li = document.createElement('li');
    li.dataset.i = i;
    const at = s.cross ?? s.from;
    const cls = s.target ? 'target' : labelOf(s) === 'crossed' ? 'crossed' : '';
    const key = sightingKey(s);
    const auto = [isUnregistered(s) ? NOT_REGISTERED : null, s.template, s.zone, s.direction].filter(Boolean)
      .map((t) => `<span class="chip${t === NOT_REGISTERED ? ' unregistered' : ''}">${escapeHtml(t)}</span>`).join('');
    const mine = (state.tags[key] || []).map((t) => `<span class="chip manual">${escapeHtml(manualTag(t))}</span>`).join('');
    if (key === state.selected) li.classList.add('selected');
    li.innerHTML = `
      <span class="bib">${s.bib}</span>
      <span class="label ${cls}">${escapeHtml(autoTag(s))}${s.target ? ' · target' : ''}</span>
      <span class="when">${fmt(at)}${reader(at) != null ? '<br>' + fmt(reader(at)) : ''}</span>
      ${auto || mine ? `<span class="chips">${auto}${mine}</span>` : ''}
      ${s.note ? `<span class="note">${s.note}</span>` : ''}`;
    li.addEventListener('click', () => { swipe.lastEnd = 0; selectSighting(key); video.currentTime = Math.max(0, at - 2); video.pause(); });
    list.appendChild(li);
  });
  if (!list.children.length) list.innerHTML = '<li class="muted">No sightings</li>';
  lastListKey = '';
}

function renderTimeline() {
  const tl = $('layers');
  tl.innerHTML = '';
  const dur = video.duration || state.data?.duration || 1;
  for (const s of state.segments) {
    const el = document.createElement('div');
    el.className = `seg ${s.kind}${s.kind === 'fixed' && !s.mat ? ' nomat' : ''}`;
    el.style.left = `${(s.from / dur) * 100}%`; el.style.width = `${((s.to - s.from) / dur) * 100}%`;
    el.title = `#${s.index} ${s.kind} ${fmt(s.from, false)}–${fmt(s.to, false)}`;
    tl.appendChild(el);
  }
  // Shade every part of the video not read yet (scans can start mid-video and wrap round).
  if (state.data?.coarseHits && Array.isArray(state.data.coarseDone)) {
    const done = [...state.data.coarseDone].sort((a, b) => a[0] - b[0]);
    let cursor = 0;
    const gaps = [];
    for (const [a, b] of done) { if (a - cursor > 1) gaps.push([cursor, a]); cursor = Math.max(cursor, b); }
    if (dur - cursor > 1) gaps.push([cursor, dur]);
    for (const [a, b] of gaps) {
      const el = document.createElement('div');
      el.className = 'unscanned';
      el.style.left = `${(a / dur) * 100}%`; el.style.width = `${((b - a) / dur) * 100}%`;
      el.title = `Not scanned yet: ${fmt(a, false)}–${fmt(b, false)}`;
      tl.appendChild(el);
    }
  }
  if (state.readingAt != null) {
    const el = document.createElement('div');
    el.className = 'reading';
    el.style.left = `${(state.readingAt / dur) * 100}%`;
    el.title = `Scanning here (${fmt(state.readingAt, false)})`;
    tl.appendChild(el);
  }
  for (const s of state.sightings) {
    if (s.cross == null && !s.target) continue;
    const el = document.createElement('div');
    el.className = `tick${s.target ? ' target' : ''}`;
    el.style.left = `${((s.cross ?? s.from) / dur) * 100}%`;
    el.title = `${s.bib} ${s.label} ${fmt(s.cross ?? s.from)}`;
    tl.appendChild(el);
  }
}

// ---------- QuickTime-style scrubber ----------
// Drag anywhere on the bar; the picture follows while dragging. Seeks are coalesced
// (a new one is only issued once the previous has landed) so scrubbing never queues
// up behind itself, and fastSeek (keyframe seek) is used mid-drag where available.
const scrub = { dragging: false, wasPlaying: false, pending: null, previewTime: null };
const duration = () => video.duration || state.data?.duration || 0;

function timeAtPointer(e) {
  const rect = $('timeline').getBoundingClientRect();
  return Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1) * duration();
}

function requestSeek(t, precise) {
  scrub.previewTime = t;
  if (video.seeking) { scrub.pending = { t, precise }; return; }
  if (!precise && typeof video.fastSeek === 'function') video.fastSeek(t); else video.currentTime = t;
}
video.addEventListener('seeked', () => {
  if (scrub.pending) { const p = scrub.pending; scrub.pending = null; requestSeek(p.t, p.precise); }
  else if (!scrub.dragging && !swipe.active) scrub.previewTime = null;
});

function showHover(e, t) {
  const tip = $('hoverTime');
  const rect = $('timeline').getBoundingClientRect();
  tip.hidden = false;
  tip.style.left = `${Math.min(Math.max(e.clientX - rect.left, 30), rect.width - 30)}px`;
  const seg = segmentAt(t);
  tip.textContent = fmt(t) + (reader(t) != null ? `  ·  ${fmt(reader(t))}` : '') + (seg && seg.kind === 'moving' ? '  · camera moving' : '');
}

const timeline = $('timeline');
timeline.addEventListener('pointerdown', (e) => {
  if (!duration()) return;
  swipe.lastEnd = 0;
  scrub.dragging = true;
  scrub.wasPlaying = !video.paused;
  video.pause();
  timeline.setPointerCapture(e.pointerId);
  timeline.classList.add('dragging');
  const t = timeAtPointer(e);
  showHover(e, t);
  requestSeek(t, false);
});
timeline.addEventListener('pointermove', (e) => {
  if (!duration()) return;
  const t = timeAtPointer(e);
  showHover(e, t);
  if (scrub.dragging) requestSeek(t, false);
});
function endDrag(e) {
  if (!scrub.dragging) return;
  scrub.dragging = false;
  timeline.classList.remove('dragging');
  requestSeek(timeAtPointer(e), true);   // land exactly where the pointer was released
  if (scrub.wasPlaying) video.play();
}
timeline.addEventListener('pointerup', endDrag);
timeline.addEventListener('pointercancel', endDrag);
timeline.addEventListener('pointerleave', () => { if (!scrub.dragging) $('hoverTime').hidden = true; });

// ---------- trackpad / Magic Mouse swipe scrubbing ----------
// Sideways swipes (two fingers on a trackpad, one finger on a Magic Mouse) arrive as
// horizontal wheel events. Over the video the swipe-speed slider sets how far a swipe moves
// (fine by default, for finding the exact crossing frame); hold ⌥ Option for 10× faster.
// Over the bar: the swipe moves the playhead as if dragging it (1 px on the bar = 1 px of
// timeline), vertical scrolling there works too. The video pauses while you swipe and
// resumes afterwards if it was playing.
const swipe = { active: false, wasPlaying: false, target: null, idleTimer: null };

// Swipe speed: the slider (0–100) maps logarithmically to 0.001–0.1 seconds of video per
// pixel of swipe over the picture (default 35 ≈ 0.005 s/px, i.e. a typical ~300 px swipe
// moves about 1.5 s). Swipes on the bar scale by the same factor. Saved per browser.
const SWIPE_DEFAULT = 35;
function swipeSecondsPerPx() { return 0.001 * Math.pow(100, Number($('swipeSpeed').value) / 100); }
function swipeFactor() { return swipeSecondsPerPx() / 0.02; }   // relative to the original tuning
function updateSwipeLabel() {
  const perSwipe = swipeSecondsPerPx() * 300;
  $('swipeSpeedLabel').textContent = `≈ ${perSwipe < 10 ? perSwipe.toFixed(1) : Math.round(perSwipe)} s/swipe`;
}
function loadSwipeSettings() {
  try {
    const v = localStorage.getItem('bibwatch.swipeSpeed');
    $('swipeSpeed').value = v != null ? v : SWIPE_DEFAULT;
    $('swipeReverse').checked = localStorage.getItem('bibwatch.swipeReverse') === '1';
  } catch (_) { $('swipeSpeed').value = SWIPE_DEFAULT; }
  updateSwipeLabel();
}
$('swipeSpeed').addEventListener('input', () => {
  updateSwipeLabel();
  try { localStorage.setItem('bibwatch.swipeSpeed', $('swipeSpeed').value); } catch (_) {}
});
$('swipeReverse').addEventListener('change', () => {
  try { localStorage.setItem('bibwatch.swipeReverse', $('swipeReverse').checked ? '1' : '0'); } catch (_) {}
});
loadSwipeSettings();

function onWheel(e) {
  if (!duration()) return;
  const overBar = e.currentTarget === timeline;
  const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;   // lines/pages → px
  let dx = e.deltaX * unit;
  const dy = e.deltaY * unit;
  // On the bar a plain vertical scroll also scrubs; over the video only sideways swipes do.
  if (overBar && Math.abs(dy) > Math.abs(dx)) dx = dy;
  if (!overBar && Math.abs(dx) <= Math.abs(dy)) return;
  e.preventDefault();   // also stops the browser's swipe-to-go-back
  if (dx === 0) return;

  if (!swipe.active) {
    swipe.active = true;
    swipe.wasPlaying = !video.paused;
    // Back-to-back swipes (e.g. momentum, or a short pause mid-swipe) continue from where the
    // previous one was heading, not from wherever the video had got to while seeking.
    const continuing = swipe.lastEnd && performance.now() - swipe.lastEnd < 1000 && swipe.target != null;
    swipe.target = continuing ? swipe.target : (scrub.previewTime ?? video.currentTime);
    video.pause();
    timeline.classList.add('dragging');
  }
  if ($('swipeReverse').checked) dx = -dx;
  const boost = e.altKey ? 10 : 1;
  const secondsPerPx = (overBar ? (duration() / timeline.clientWidth) * swipeFactor() : swipeSecondsPerPx()) * boost;
  swipe.target = Math.min(Math.max(swipe.target + dx * secondsPerPx, 0), duration());
  requestSeek(swipe.target, false);
  state.swipeFlashUntil = performance.now() + 700;

  clearTimeout(swipe.idleTimer);
  swipe.idleTimer = setTimeout(() => {   // gesture (incl. momentum) finished
    swipe.active = false;
    swipe.lastEnd = performance.now();
    timeline.classList.remove('dragging');
    requestSeek(swipe.target, true);
    if (swipe.wasPlaying) video.play();
  }, 160);
}
$('player').addEventListener('wheel', onWheel, { passive: false });
timeline.addEventListener('wheel', onWheel, { passive: false });

// Playhead position: during a drag follow the pointer (instant feedback), otherwise the video.
function updateScrubber() {
  const dur = duration();
  const t = scrub.previewTime ?? video.currentTime ?? 0;
  const f = dur ? Math.min(Math.max(t / dur, 0), 1) : 0;
  $('played').style.transform = `scaleX(${f})`;
  $('knob').style.transform = `translateX(${f * timeline.clientWidth}px)`;
  $('elapsed').textContent = fmt(t, false);
  $('remaining').textContent = '-' + fmt(Math.max(dur - t, 0), false);
}

document.querySelectorAll('#filters button').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('#filters button').forEach((x) => x.classList.toggle('active', x === b));
  state.filter = b.dataset.filter; renderList();
}));
$('search').addEventListener('input', (e) => { state.search = e.target.value.trim(); renderList(); });
$('showPeople').addEventListener('change', draw);
$('showAll').addEventListener('change', draw);

// ---------- controls ----------
function step(dt) { swipe.lastEnd = 0; video.pause(); video.currentTime = Math.min(Math.max(0, video.currentTime + dt), video.duration || Infinity); }
$('play').addEventListener('click', () => (video.paused ? video.play() : video.pause()));
$('back').addEventListener('click', () => step(-0.1));
$('fwd').addEventListener('click', () => step(0.1));
$('back1').addEventListener('click', () => step(-1));
$('fwd1').addEventListener('click', () => step(1));
$('rate').addEventListener('change', (e) => { video.playbackRate = Number(e.target.value); });
video.addEventListener('play', () => { $('play').textContent = '❚❚ Pause'; });
video.addEventListener('pause', () => { $('play').textContent = '▶︎ Play'; draw(); });
video.addEventListener('seeked', draw);
video.addEventListener('seeked', () => updateScanUI());
video.addEventListener('loadedmetadata', () => { renderTimeline(); draw(); });

$('setClock').addEventListener('click', async () => {
  video.pause();
  const answer = await uiPrompt(`Reader time at video ${fmt(video.currentTime)}?\nPause on a known crossing (e.g. a finisher's first finish read) and enter its reader time, HH:MM:SS or HH:MM:SS.s`, reader(video.currentTime) != null ? fmt(reader(video.currentTime)) : '');
  if (answer == null) return;
  const secs = parseClock(answer);
  if (secs == null) { uiAlert('Could not read that time — use HH:MM:SS or HH:MM:SS.s'); return; }
  state.clockOffset = secs - video.currentTime;
  if (state.videoName) localStorage.setItem(`bibwatch.clock.${state.videoName}`, String(state.clockOffset));
  renderList(); draw();
});

$('markMat').addEventListener('click', toggleMarking);

// ---------- correcting the camera segments by hand ----------
// Split the segment under the playhead at the current time. The part from here on gets
// `kindAfter` (default: same kind). A fixed segment's mat is kept on both halves, since
// the camera hasn't moved — re-mark either half if it did.
function splitSegment(t, kindAfter) {
  const i = state.segments.findIndex((s) => t >= s.from && t < s.to);
  if (i < 0) return null;
  const seg = state.segments[i];
  const kind = kindAfter || seg.kind;
  const kindChanged = kind !== seg.kind;
  let focus;
  if (t - seg.from < 0.25) {            // at the very start: just change this segment
    seg.kind = kind;
    if (kind !== 'fixed') seg.mat = null;
    focus = seg;
  } else {
    focus = { index: 0, from: t, to: seg.to, kind, refTime: t, mat: kind === 'fixed' && seg.kind === 'fixed' ? seg.mat : null };
    seg.to = t;
    state.segments.splice(i + 1, 0, focus);
  }
  if (kindChanged) focus = mergeAround(focus);
  return finishSegmentEdit(focus);
}

// After flipping a stretch's kind, join it with same-kind neighbours so e.g. "camera settled
// at 23:10" + the detected still segment from 23:26 become one segment with one mat.
// Only joins a still neighbour that has no mat yet (or the same mat), so deliberate splits
// for a bumped camera are kept.
function mergeAround(seg) {
  const sameMat = (a, b) => a && b && ['x0', 'y0', 'x1', 'y1'].every((k) => a[k] === b[k]);
  let i = state.segments.indexOf(seg);
  const next = state.segments[i + 1];
  if (next && next.kind === seg.kind && (seg.kind === 'moving' || !next.mat || !seg.mat || sameMat(next.mat, seg.mat))) {
    seg.to = next.to; seg.mat = seg.mat || next.mat;
    state.segments.splice(i + 1, 1);
  }
  i = state.segments.indexOf(seg);
  const prev = state.segments[i - 1];
  if (prev && prev.kind === seg.kind && (seg.kind === 'moving' || !prev.mat || !seg.mat || sameMat(prev.mat, seg.mat))) {
    prev.to = seg.to; prev.mat = prev.mat || seg.mat;
    state.segments.splice(i, 1);
    return prev;
  }
  return seg;
}

function finishSegmentEdit(focus) {
  state.segments.forEach((s, k) => { s.index = k + 1; });
  state.segmentsEdited = true;
  renderTimeline();
  draw();
  setStatus(`Segment #${focus.index} is now ${focus.kind} from ${fmt(focus.from)}.`);
  resync();
  saveSegmentsSoon();
  return focus;
}

$('splitSegment').addEventListener('click', () => { video.pause(); splitSegment(video.currentTime); });
$('toggleKind').addEventListener('click', () => {
  video.pause();
  const seg = segmentAt(video.currentTime);
  if (!seg) return;
  // Flip from the playhead onward (a whole-segment flip when at its start).
  splitSegment(video.currentTime, seg.kind === 'fixed' ? 'moving' : 'fixed');
});
async function toggleMarking() {
  if (!state.segments.length) { uiAlert('Load a segments.json or detections.json first (or run a scan)'); return; }
  video.pause();
  let seg = segmentAt(video.currentTime);
  if (!state.marking && seg.kind !== 'fixed') {
    // Automatic detection can end a "moving" stretch a few seconds late (or miss that the
    // camera had already settled). Let the person watching decide.
    const t = video.currentTime;
    const ok = await uiConfirm(`The camera was detected as moving here (${fmt(seg.from, false)}–${fmt(seg.to, false)}).\n\n` +
      `If it has already settled, treat it as still from ${fmt(t)} onward and mark the mat?`);
    if (!ok) return;
    seg = splitSegment(t, 'fixed');
  }
  state.marking = state.marking ? null : [];
  $('player').classList.toggle('marking', !!state.marking);
  $('markMat').classList.toggle('on', !!state.marking);
  draw();
}
canvas.addEventListener('click', (e) => {
  if (!state.marking || state.picking) return;
  const r = contentRect();
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left - r.x) / r.w, y = (e.clientY - rect.top - r.y) / r.h;
  if (x < 0 || x > 1 || y < 0 || y > 1) return;
  state.marking.push({ x: +x.toFixed(4), y: +y.toFixed(4) });
  if (state.marking.length === 2) {
    const [a, b] = state.marking[0].x <= state.marking[1].x ? state.marking : [state.marking[1], state.marking[0]];
    const seg = segmentAt(video.currentTime);
    seg.mat = { x0: a.x, y0: a.y, x1: b.x, y1: b.y };
    state.marking = null;
    $('player').classList.remove('marking');
    $('markMat').classList.remove('on');
    renderTimeline();
    setStatus(`Mat set for segment #${seg.index}.`);
    resync();
    saveSegmentsSoon();
  }
  draw();
});

$('exportSegments').addEventListener('click', () => {
  if (!state.segments.length) { uiAlert('Nothing to export yet'); return; }
  const out = { video: state.data?.video || state.videoName, duration: state.data?.duration || video.duration, segments: state.segments };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }));
  a.download = `segments_${(out.video || 'video').replace(/\.[^.]+$/, '')}.json`;
  a.click();
  const unmarked = state.segments.filter((s) => s.kind === 'fixed' && !s.mat).length;
  setStatus(unmarked ? `Exported — ${unmarked} fixed segment(s) still have no mat (no crossings will be counted there)` : 'Exported segments.json');
});

document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') return;
  if ($('uiDialog').open || $('clearDialog').open) return;   // shortcuts off while a question is open
  if (e.key === ' ') { e.preventDefault(); video.paused ? video.play() : video.pause(); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); step(e.shiftKey ? -1 : -0.1); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); step(e.shiftKey ? 1 : 0.1); }
  else if (e.key === ']' || e.key === '[') {
    const t = video.currentTime;
    const times = state.sightings.filter(visible).map((s) => s.cross ?? s.from).sort((a, b) => a - b);
    const next = e.key === ']' ? times.find((x) => x - 2 > t + 0.05) : [...times].reverse().find((x) => x - 2 < t - 0.05);
    if (next != null) { swipe.lastEnd = 0; video.currentTime = Math.max(0, next - 2); }
  } else if (e.key === 'm' || e.key === 'M') toggleMarking();
  else if (e.key === 'c' || e.key === 'C') $('toggleKind').click();
  else if (e.key === 'r' || e.key === 'R') resync();
  else if (/^[1-4]$/.test(e.key) && state.selected) toggleTag(PRESET_TAGS[Number(e.key) - 1]);
  else if (e.key === 's' || e.key === 'S') $('splitSegment').click();
  // QuickTime-style shuttle: L plays (again = faster), K pauses, J steps back
  // (browsers can't play in reverse, so J jumps back 1 s per press).
  else if (e.key === 'l' || e.key === 'L') {
    const rates = [1, 2, 4];
    const next = video.paused ? 1 : rates[Math.min(rates.indexOf(video.playbackRate) + 1, rates.length - 1)] || 1;
    video.playbackRate = next; $('rate').value = String(next); video.play();
  } else if (e.key === 'k' || e.key === 'K') { video.pause(); video.playbackRate = 1; $('rate').value = '1'; }
  else if (e.key === 'j' || e.key === 'J') step(-1);
});

// ---------- local server: library + Run scan ----------
// Only when the viewer is opened through the local server (server/, 127.0.0.1). Scans run on this Mac;
// each video's reads accumulate in <media>/scans/<video>/, so a re-run only reads new frames.
const PHASES = {
  scan: 'Scanning',
  segments: 'Finding camera positions',
  coarse: 'Reading bibs (pass 1 of 2)',
  fine: 'Following runners (pass 2 of 2)',
};
let pollTimer = null;

async function api(path, body) {
  const r = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `${r.status}`);
  return j;
}

async function probeServer() {
  try { state.server = await api('/api/media'); } catch (_) { state.server = null; }
  const lib = $('library');
  if (state.server) {
    $('libraryWrap').hidden = false;
    loadTemplates();
    for (const v of state.server.videos) {
      const o = document.createElement('option'); o.value = v; o.textContent = v + (state.server.scans[v.replace(/\.[^.]+$/, '')]?.detections ? '  ✓ scanned' : '');
      lib.appendChild(o);
    }
    if (state.mediaVideo) lib.value = state.mediaVideo;
    const job = await api('/api/scan').catch(() => null);
    if (job && ['starting', 'segments', 'scanning'].includes(job.state)) followScan();
  }
  updateScanUI();
}

$('library').addEventListener('change', async (e) => {
  const name = e.target.value;
  if (!name) return;
  loadVideo(`/media/${encodeURIComponent(name)}`, name);
  const scan = state.server?.scans[name.replace(/\.[^.]+$/, '')];
  const data = scan?.detections || scan?.segments;
  state.tags = {}; state.selected = null;
  if (data) {
    loadData(await (await fetch(data, { cache: 'no-store' })).json());
    // Mats / segment edits are saved separately as you make them — the latest wins.
    if (scan?.detections && scan?.segments) {
      const saved = await fetch(scan.segments, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (saved?.segments?.length) {
        state.segments = saved.segments;
        if (state.data) state.data.segments = saved.segments;
        resync(false); renderTimeline();
        const marked = saved.segments.filter((s) => s.kind === 'fixed' && s.mat).length;
        setStatus(`${name} · ${state.sightings.length} sightings · restored ${marked} marked mat(s) from last time`);
      }
    }
  } else { state.data = null; state.frames = []; state.segments = []; state.sightings = []; renderList(); renderTimeline(); setStatus(`${name} · not scanned yet — press Run scan`); }
  await loadTags(scan?.tags);
});

function updateScanUI() {
  const btn = $('runScan');
  const running = pollTimer != null;
  const here = state.mediaVideo && video.currentTime > 1 ? ` from ${fmt(video.currentTime, false)}` : '';
  btn.textContent = running ? 'Stop scan' : state.data?.scanning ? `Continue scan${here}` : (state.data?.coarseHits ? `Run scan${here} (update)` : `Run scan${here}`);
  btn.disabled = !running && (!state.server || !state.mediaVideo);
  btn.title = !state.server ? 'Open the viewer through the local server (server/: npm run start:prod) to scan from here'
    : !state.mediaVideo ? 'Pick the video from the Library (the scanner needs it in the media folder)'
    : 'Read bibs in this video on this Mac (only frames not read before)';
  btn.classList.toggle('attention', !running && state.needsScan > 0);
  $('resync').disabled = !state.data?.coarseHits;
  $('clearScans').disabled = running || !state.server || !state.mediaVideo;
}

$('runScan').addEventListener('click', async () => {
  if (pollTimer) { await api('/api/scan/cancel', {}).catch(() => {}); return; }
  if (!state.mediaVideo) return;
  const body = {
    video: state.mediaVideo,
    segments: state.segments.length ? { video: state.data?.video || state.videoName, duration: state.data?.duration || video.duration, segments: state.segments } : null,
    clock: state.clockOffset != null ? fmt(state.clockOffset) : null,
    templates: [...state.useTemplates].filter((id) => state.templates.some((t) => t.id === id)),
    from: +video.currentTime.toFixed(1),   // start where you are; wraps round to the beginning
  };
  try {
    await api('/api/scan', body); followScan();
    // The mat is optional: without one, bibs in that camera position are tagged 001 Viewed.
    const noMat = state.segments.filter((s) => s.kind === 'fixed' && !s.mat).length;
    if (noMat) setStatus(`Scanning… ${noMat} camera position(s) have no mat marked — bibs there are tagged 001 Viewed (mark a mat any time to get 000 Crossed the mat).`);
  } catch (e) { uiAlert(`Could not start the scan: ${e.message}`); }
});

function followScan() {
  $('scanProgress').hidden = false;
  $('scanProgress').className = '';
  clearInterval(pollTimer);
  let lastCheckpoint = null;
  pollTimer = setInterval(async () => {
    let j;
    try { j = await api('/api/scan'); } catch (_) { return; }
    const running = ['starting', 'segments', 'scanning'].includes(j.state);
    const here = j.video === state.mediaVideo;   // only update the view if it's this video

    // Results so far: reload each progress save while scanning (and the final one).
    if (here && j.partial && j.checkpoint && j.checkpoint !== lastCheckpoint) {
      lastCheckpoint = j.checkpoint;
      try { applyScanData(await (await fetch(j.partial, { cache: 'no-store' })).json()); } catch (_) { /* mid-write; next poll */ }
    }

    const frac = j.total ? j.done / j.total : 0;
    const eta = j.eta != null ? ` · ~${j.eta >= 90 ? Math.round(j.eta / 60) + ' min' : Math.round(j.eta) + ' s'} left` : '';
    if (running) {
      $('scanFill').style.width = `${Math.round(frac * 100)}%`;
      const where = j.phase === 'scan' && j.at != null ? ` — reading at ${fmt(j.at, false)}` : '';
      state.readingAt = here && j.phase === 'scan' ? j.at : null;
      const found = here && state.sightings.length ? ` · ${state.sightings.length} sightings so far` : '';
      renderTimeline();
      $('scanText').textContent = `${j.video}: ${PHASES[j.phase] || 'Starting…'}${where} ${j.total ? Math.round(frac * 100) + '%' : ''}${eta}${found}`;
      updateScanUI();
      return;
    }
    clearInterval(pollTimer); pollTimer = null;
    state.readingAt = null; renderTimeline();
    const opt = [...$('library').options].find((o) => o.value === j.video);
    if (opt && !opt.textContent.includes('✓') && j.partial) opt.textContent += '  ✓ scanned';
    if (state.server && j.partial) {
      const stem = j.video.replace(/\.[^.]+$/, '');
      state.server.scans[stem] = { ...(state.server.scans[stem] || {}), detections: j.partial };
    }
    if (j.state === 'done') {
      $('scanProgress').className = 'done';
      $('scanFill').style.width = '100%';
      const crossed = here ? state.sightings.filter((s) => labelOf(s) === 'crossed').length : null;
      $('scanText').textContent = `${j.video}: scan finished in ${Math.round(j.elapsed / 60)} min` + (here ? ` · ${state.sightings.length} sightings, ${crossed} crossed the mat` : '');
    } else if (j.state === 'cancelled') {
      $('scanProgress').className = '';
      $('scanText').textContent = `${j.video}: stopped — everything read so far is kept. Run scan continues from there.`;
    } else {
      $('scanProgress').className = 'failed';
      $('scanText').textContent = `Scan failed: ${j.message || 'unknown error'}`;
    }
    updateScanUI();
  }, 1000);
  updateScanUI();
}

// Load scan results (a progress save or the final file) without losing your place: your
// mats / segment edits, the selected sighting, filters and the list's scroll position stay.
function applyScanData(d) {
  const keepSegments = state.segments.length ? state.segments : null;
  const scroll = $('list').scrollTop;
  loadData(d);
  if (keepSegments) { state.segments = keepSegments; if (state.data) state.data.segments = keepSegments; resync(false); }
  renderTimeline();
  $('list').scrollTop = scroll;
}

// Save mats and segment edits to <media>/scans/<video>/segments.json as they're made, so a
// refresh (or another day) keeps them — like the scan itself. Batched a moment after the last edit.
let saveTimer = null;
function saveSegmentsSoon() {
  if (!state.server || !state.mediaVideo || !state.segments.length) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await api('/api/segments', { video: state.mediaVideo, segments: { video: state.data?.video || state.videoName, duration: state.data?.duration || video.duration, segments: state.segments } });
      const stem = state.mediaVideo.replace(/\.[^.]+$/, '');
      if (state.server.scans[stem]) state.server.scans[stem].segments = `/media/scans/${stem}/segments.json`;
      else state.server.scans[stem] = { segments: `/media/scans/${stem}/segments.json` };
      saveTimer = null;
      $('status').textContent += ' · saved';
    } catch (e) {
      saveTimer = null;
      setStatus(`⚠️ Could not save your mats: ${e.message} — use Export segments.json as a backup`);
    }
  }, 400);
}
window.addEventListener('beforeunload', (e) => { if (saveTimer) { e.preventDefault(); e.returnValue = ''; } });

$('resync').addEventListener('click', () => resync());

// Clear the saved scan of this video (asks first; can keep the mats / camera fixes).
$('clearScans').addEventListener('click', () => {
  if (!state.server || !state.mediaVideo) return;
  const dlg = $('clearDialog');
  $('clearVideo').textContent = state.mediaVideo;
  const mins = Math.max(1, Math.round(((state.data?.duration || video.duration || 0) / 60) * 0.6));
  $('clearEstimate').textContent = `about ${mins} min for this video`;
  dlg.returnValue = 'cancel';
  dlg.showModal();
  dlg.addEventListener('close', async () => {
    if (dlg.returnValue !== 'keep' && dlg.returnValue !== 'all') return;
    const keepSegments = dlg.returnValue === 'keep';
    try {
      const r = await api('/api/scans/clear', { video: state.mediaVideo, keepSegments });
      const stem = state.mediaVideo.replace(/\.[^.]+$/, '');
      const keep = keepSegments ? state.segments : [];
      state.data = keep.length ? { video: state.videoName, duration: video.duration, segments: keep, frames: [], sightings: [] } : null;
      state.frames = []; state.sightings = []; state.crossedBibs = new Set(); state.needsScan = 0;
      state.segments = keep;
      if (state.server.scans[stem]) {
        state.server.scans[stem].detections = null;
        if (!keepSegments) delete state.server.scans[stem];
      }
      const opt = [...$('library').options].find((o) => o.value === state.mediaVideo);
      if (opt) opt.textContent = state.mediaVideo;
      $('scanProgress').hidden = true;
      renderList(); renderTimeline(); updateScanUI(); draw();
      setStatus(`Cleared ${r.removed.length ? r.removed.join(', ') : 'nothing (no saved scan)'}` + (keepSegments ? ' · mats and camera fixes kept' : ''));
    } catch (e) {
      uiAlert(`Could not clear: ${e.message}`);
    }
  }, { once: true });
});
probeServer();

// ---------- tags ----------
// Automatic: zone (background / before-mat / on-mat / past-mat) and direction (toward / away /
// still), decided with the crossings. Yours: anything you add to a sighting, saved per video in
// <media>/scans/<video>/tags.json as you make them.
// Numbered tags. Automatic ones come from the crossing decision (mirror of tagCode in Scan.swift);
// yours start at 100 — presets 100–103 (keys 1–4), anything you type gets the next free code,
// remembered per video (stored in tags.json under "__codes").
const AUTO_TAGS = {
  crossed: ['000', 'Crossed the mat'], viewed: ['001', 'Viewed'], 'near-mat': ['002', 'Near the mat'],
  passing: ['003', 'Passing'], 'camera-moving': ['004', 'Camera moving'], duplicate: ['005', 'Duplicate'],
  'needs-scan': ['', 'Not read here yet — Run scan'],
};
const LEGACY_LABELS = { lingering: 'near-mat', 'no-mat': 'viewed', 'no-person': 'viewed', unclear: 'viewed' };
const labelOf = (s) => LEGACY_LABELS[s.label] || s.label;
const autoTag = (s) => { const [code, name] = AUTO_TAGS[labelOf(s)] || ['', labelOf(s)]; return code ? `${code} ${name}` : name; };
const PRESET_TAGS = ['finisher', 'photo', 'misread', 'wrong bib'];
function codeOf(tag) {
  const i = PRESET_TAGS.indexOf(tag);
  if (i >= 0) return String(100 + i);
  const codes = state.tags.__codes || (state.tags.__codes = {});
  if (!codes[tag]) {
    const used = new Set(Object.values(codes).map(Number));
    let n = 100 + PRESET_TAGS.length;
    while (used.has(n)) n++;
    codes[tag] = String(n);
  }
  return codes[tag];
}
const manualTag = (t) => `${codeOf(t)} ${t}`;
const sightingKey = (s) => `${s.bib}@${s.from.toFixed(1)}`;
// 006 Not registered: the bib isn't in the race's participant list (media/registered.txt).
const NOT_REGISTERED = '006 Not registered';
function isUnregistered(s) {
  const list = state.data?.registered;
  if (Array.isArray(list) && list.length) return !list.includes(s.bib);
  return s.registered === false;
}
const allTags = (s) => [autoTag(s), isUnregistered(s) ? NOT_REGISTERED : null, s.zone, s.direction, s.template, ...(state.tags[sightingKey(s)] || []).map(manualTag)].filter(Boolean);
const escapeHtml = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function selectSighting(key) {
  state.selected = key;
  renderTagBar();
  document.querySelectorAll('#list li[data-i]').forEach((li) => {
    li.classList.toggle('selected', sightingKey(state.sightings[li.dataset.i]) === key);
  });
}

function renderTagBar() {
  const s = state.sightings.find((x) => sightingKey(x) === state.selected);
  $('tagBar').hidden = !s;
  if (!s) return;
  $('tagTitle').textContent = `Tags for ${s.bib} · seen ${fmt(s.from)}${reader(s.from) != null ? ' (' + fmt(reader(s.from)) + ')' : ''}  —  keys 1–4`;
  const mine = state.tags[state.selected] || [];
  const custom = mine.filter((t) => !PRESET_TAGS.includes(t));
  $('tagButtons').innerHTML = '';
  [...PRESET_TAGS, ...custom].forEach((t, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = i < PRESET_TAGS.length ? `${i + 1} · ${manualTag(t)}` : `${manualTag(t)} ×`;
    b.classList.toggle('on', mine.includes(t));
    b.addEventListener('click', () => toggleTag(t));
    $('tagButtons').appendChild(b);
  });
}

function toggleTag(tag) {
  if (!state.selected || !tag) return;
  const list = new Set(state.tags[state.selected] || []);
  list.has(tag) ? list.delete(tag) : list.add(tag);
  if (list.size) state.tags[state.selected] = [...list]; else delete state.tags[state.selected];
  renderTagBar(); renderList(); refreshTagFilter(); saveTagsSoon();
}

$('customTag').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  toggleTag(e.target.value.trim().toLowerCase());
  e.target.value = '';
});

function refreshTagFilter() {
  const sel = $('tagFilter');
  const seen = new Set();
  state.sightings.forEach((s) => allTags(s).forEach((t) => seen.add(t)));
  const current = sel.value;
  sel.innerHTML = '<option value="">Any tag</option>' + [...seen].sort().map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
  sel.value = seen.has(current) ? current : '';
  state.tagFilter = sel.value;
}
$('tagFilter').addEventListener('change', (e) => { state.tagFilter = e.target.value; renderList(); });

let tagTimer = null;
function saveTagsSoon() {
  if (!state.server || !state.mediaVideo) { setStatus('Tags are kept for this session only — open the video from the Library to save them'); return; }
  clearTimeout(tagTimer);
  tagTimer = setTimeout(async () => {
    try {
      await api('/api/tags', { video: state.mediaVideo, tags: state.tags });
      tagTimer = null;
      const stem = state.mediaVideo.replace(/\.[^.]+$/, '');
      state.server.scans[stem] = { ...(state.server.scans[stem] || {}), tags: `/media/scans/${stem}/tags.json` };
    } catch (e) {
      tagTimer = null;
      setStatus(`⚠️ Could not save tags: ${e.message}`);
    }
  }, 400);
}

async function loadTags(url) {
  state.tags = {};
  state.selected = null;
  if (url) state.tags = await fetch(url, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  renderTagBar(); renderList(); refreshTagFilter();
}

// Click a bib box on the video to select that sighting.
canvas.addEventListener('click', (e) => {
  if (state.marking || state.picking) return;
  const f = nearestFrame(video.currentTime);
  if (!f) return;
  const r = contentRect(), rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left - r.x) / r.w, y = (e.clientY - rect.top - r.y) / r.h;
  const hit = f.bibs.find((b) => x >= b.box[0] - 0.01 && x <= b.box[2] + 0.01 && y >= b.box[1] - 0.01 && y <= b.box[3] + 0.01);
  if (!hit) return;
  const t = video.currentTime;
  const s = state.sightings.filter((x2) => x2.bib === hit.bib)
    .sort((a, b) => Math.min(Math.abs(t - a.from), Math.abs(t - a.to)) - Math.min(Math.abs(t - b.from), Math.abs(t - b.to)))[0];
  if (s) { selectSighting(sightingKey(s)); setStatus(`Selected ${s.bib} — tag it in the side panel (1–5)`); }
});

// CSV of every sighting with automatic and your own tags.
$('exportCsv').addEventListener('click', () => {
  if (!state.sightings.length) { uiAlert('No sightings to export yet'); return; }
  const q = (v) => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const rows = [['bib', 'target', 'registered', 'design', 'segment', 'seen_from', 'seen_to', 'seen_from_reader', 'tag_code', 'tag', 'crossed_at', 'crossed_at_reader', 'zone', 'direction', 'my_tags', 'note']];
  for (const s of state.sightings) {
    const [code, name] = AUTO_TAGS[labelOf(s)] || ['', labelOf(s)];
    rows.push([s.bib, s.target ? 'yes' : '', isUnregistered(s) ? 'no' : (state.data?.registered?.length || s.registered != null ? 'yes' : ''), s.template || '', s.segment, fmt(s.from), fmt(s.to), reader(s.from) != null ? fmt(reader(s.from)) : '', code, name,
      s.cross != null ? fmt(s.cross) : '', s.cross != null && reader(s.cross) != null ? fmt(reader(s.cross)) : '',
      s.zone || '', s.direction || '', (state.tags[sightingKey(s)] || []).map(manualTag).join('; '), s.note || '']);
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([rows.map((r) => r.map(q).join(',')).join('\n') + '\n'], { type: 'text/csv' }));
  a.download = `sightings_${(state.mediaVideo || state.videoName || 'video').replace(/\.[^.]+$/, '')}.csv`;
  a.click();
});

// ---------- bib templates ----------
// A template = one bib design, measured from its artwork and/or clear bibs in the footage.
// Ticked templates are used by Run scan and by the "what the templates find" overlay.
async function loadTemplates() {
  if (!state.server) return;
  try { state.templates = (await api('/api/templates')).templates; } catch (_) { return; }
  $('templatesPanel').hidden = false;
  renderTemplates();
}

function renderTemplates() {
  const ul = $('tplList');
  ul.innerHTML = '';
  for (const t of state.templates) {
    const li = document.createElement('li');
    const on = state.useTemplates.has(t.id);
    li.innerHTML = `<input type="checkbox" ${on ? 'checked' : ''} title="Use this design in scans">
      <span class="swatch" style="background:hsl(${t.hue}, 85%, 50%)"></span>
      <span class="tname" title="${escapeHtml(t.name)}">${escapeHtml(t.name)}<br><span class="meta">bibs ${t.minBib}–${t.maxBib} · ${t.calibrated ? `calibrated on ${t.calibrated}` : 'not calibrated yet'}</span></span>
      <button class="cal" title="Click clear bibs of this design in the video to tune it">Calibrate</button>
      <button class="del" title="Remove this template">×</button>`;
    li.querySelector('input').addEventListener('change', (e) => {
      e.target.checked ? state.useTemplates.add(t.id) : state.useTemplates.delete(t.id);
      localStorage.setItem('bibwatch.templates', JSON.stringify([...state.useTemplates]));
      renderTemplates(); refreshFinder();
    });
    const cal = li.querySelector('.cal');
    cal.classList.toggle('on', state.picking?.mode === 'calibrate' && state.picking.template === t.id);
    cal.addEventListener('click', () => startPicking({ mode: 'calibrate', template: t.id, name: t.name }));
    li.querySelector('.del').addEventListener('click', async () => {
      if (!(await uiConfirm(`Remove the template "${t.name}"? Scans already made keep their results.`, 'Remove'))) return;
      state.templates = (await api('/api/templates/delete', { template: t.id })).templates;
      state.useTemplates.delete(t.id);
      renderTemplates();
    });
    ul.appendChild(li);
  }
  if (!state.templates.length) ul.innerHTML = '<li class="muted">No templates yet — add one from the bib artwork or a bib in the video.</li>';
  const used = state.templates.filter((t) => state.useTemplates.has(t.id)).length;
  $('tplSummary').textContent = used ? `· ${used} in use` : '· none in use (whole-frame reading)';
}

function startPicking(p) {
  if (!state.mediaVideo) { uiAlert('Open the video from the Library first'); return; }
  video.pause();
  state.picking = state.picking && state.picking.mode === p.mode && state.picking.template === p.template ? null : p;
  $('player').classList.toggle('marking', !!state.picking);
  renderTemplates(); draw();
}

async function askRange(defMax) {
  const name = await uiPrompt('Name for this bib design (e.g. "5K pink", "1K teal"):', '');
  if (name == null || !name.trim()) return null;
  const range = await uiPrompt('Bib numbers on this design, as FROM-TO:', `1-${defMax}`);
  if (range == null) return null;
  const m = String(range).match(/(\d+)\s*-\s*(\d+)/);
  return { name: name.trim(), minBib: m ? Number(m[1]) : 1, maxBib: m ? Number(m[2]) : defMax };
}

$('tplImage').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  const info = await askRange(state.data?.maxBib || 250);
  if (!info) return;
  const image = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(file); });
  try {
    const r = await api('/api/templates', { ...info, image });
    state.templates = r.templates; state.useTemplates.add(r.id);
    localStorage.setItem('bibwatch.templates', JSON.stringify([...state.useTemplates]));
    renderTemplates();
    setStatus(`Template "${info.name}" made from the artwork. Now Calibrate it: click 3–5 clear bibs of that design in the video.`);
  } catch (err) { uiAlert(`Could not make the template: ${err.message}`); }
});

$('tplFromVideo').addEventListener('click', () => startPicking({ mode: 'new' }));

canvas.addEventListener('click', async (e) => {
  if (!state.picking) return;
  const r = contentRect(), rect = canvas.getBoundingClientRect();
  const x = +((e.clientX - rect.left - r.x) / r.w).toFixed(4), y = +((e.clientY - rect.top - r.y) / r.h).toFixed(4);
  if (x < 0 || x > 1 || y < 0 || y > 1) return;
  const at = [+video.currentTime.toFixed(3), x, y];
  const p = state.picking;
  try {
    if (p.mode === 'new') {
      state.picking = null; $('player').classList.remove('marking');
      const info = await askRange(state.data?.maxBib || 250);
      if (!info) { draw(); return; }
      setStatus('Measuring that bib…');
      const res = await api('/api/templates', { ...info, video: state.mediaVideo, at });
      state.templates = res.templates; state.useTemplates.add(res.id);
      localStorage.setItem('bibwatch.templates', JSON.stringify([...state.useTemplates]));
      setStatus(`Template "${info.name}" made from that bib. Calibrate it on a few more to make it sturdier.`);
    } else {
      setStatus('Measuring that bib…');
      const res = await api('/api/templates/calibrate', { template: p.template, video: state.mediaVideo, at });
      state.templates = res.templates;
      const last = res.message.split('\n').filter(Boolean).pop();
      setStatus(`${p.name}: ${last} — click another bib, or Esc when done`);
    }
    renderTemplates(); refreshFinder();
  } catch (err) {
    setStatus(`⚠️ ${err.message.split('\n').pop()}`);
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state.picking) { state.picking = null; $('player').classList.remove('marking'); renderTemplates(); draw(); }
});

// "What the templates find": ask the server for the paused frame (not while playing).
let finderTimer = null;
function refreshFinder() {
  clearTimeout(finderTimer);
  if (!$('showFinder').checked || !video.paused || !state.mediaVideo) return;
  const ids = [...state.useTemplates].filter((id) => state.templates.some((t) => t.id === id));
  if (!ids.length) { state.finder = null; draw(); return; }
  finderTimer = setTimeout(async () => {
    const t = +video.currentTime.toFixed(3);
    try {
      const f = await api(`/api/finder?video=${encodeURIComponent(state.mediaVideo)}&t=${t}&templates=${encodeURIComponent(ids.join(','))}`);
      if (Math.abs(video.currentTime - t) < 0.05) { state.finder = { ...f, t }; draw(); }
    } catch (_) { /* ignore */ }
  }, 250);
}
$('showFinder').addEventListener('change', () => { state.finder = null; refreshFinder(); draw(); });
video.addEventListener('seeked', refreshFinder);
video.addEventListener('pause', refreshFinder);

// ---------- render loop ----------
// One requestAnimationFrame loop at display refresh rate: the scrubber glides smoothly
// (not only when a new video frame is decoded) and the overlay follows the picture
// while playing, scrubbing or stepping.
function loop() {
  updateScrubber();
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
