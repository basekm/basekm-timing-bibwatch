import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers
import Vision

// MARK: - Answer keys

/// A hand-checked list of the bibs in a stretch of video. One bib per line; `#` starts a comment.
/// A bib ending in `?` is unsure: it counts neither as found/missed nor as wrong.
/// `# range: 02:30-03:00` limits scoring to that part of the video.
struct AnswerKey {
  var bibs: Set<String> = []
  var unsure: Set<String> = []
  var range: (Double, Double)? = nil

  init(path: String) {
    guard let text = try? String(contentsOfFile: path, encoding: .utf8) else { die("cannot read \(path)") }
    for line in text.split(whereSeparator: \.isNewline) {
      let parts = line.split(separator: "#", maxSplits: 1, omittingEmptySubsequences: false)
      if parts.count > 1 {
        let comment = parts[1].trimmingCharacters(in: .whitespaces)
        if comment.hasPrefix("range:") {
          let r = comment.dropFirst("range:".count).split(separator: "-").map { parseTime($0.trimmingCharacters(in: .whitespaces)) }
          if r.count == 2 { range = (r[0], r[1]) }
        }
      }
      for token in parts[0].split(whereSeparator: { $0 == " " || $0 == "," || $0 == "\t" }) {
        let isUnsure = token.hasSuffix("?")
        let bib = normalizeBib(String(isUnsure ? token.dropLast() : token))
        guard !bib.isEmpty else { continue }
        if isUnsure { unsure.insert(bib) } else { bibs.insert(bib) }
      }
    }
  }
}

/// "147" → "0147" with classic 4-digit bibs, as the scanner writes them.
func normalizeBib(_ s: String) -> String {
  guard !s.isEmpty, s.allSatisfy(\.isNumber) else { return s }
  return BibText.isClassic && s.count < 4 ? String(repeating: "0", count: 4 - s.count) + s : s
}

/// A scan folder (or its detections.json), named after the folder.
func loadScan(_ path: String) -> (name: String, detections: Detections) {
  var isDir: ObjCBool = false
  let file = FileManager.default.fileExists(atPath: path, isDirectory: &isDir) && isDir.boolValue ? path + "/detections.json" : path
  let name = URL(fileURLWithPath: file).deletingLastPathComponent().lastPathComponent
  return (name, readJSON(Detections.self, file))
}

// MARK: - score

func runScore(_ raw: [String]) {
  let args = Args(raw, switches: ["brief"])
  applyBibOptions(args)
  guard args.positional.count >= 2 else {
    die("""
      usage: bibwatch score <key.txt> <scanDir> [<scanDir> …] [--start mm:ss] [--end mm:ss] [--digits 4-6] [--brief]

      Compares each scan's sightings with a hand-checked answer key (see `bibwatch review`).
        listed       key bibs the runner list shows (a sighting not folded away as a duplicate)
        read         key bibs read at all (listed, or only as someone's duplicate)
        wrong listed numbers not in the key that the runner list still shows as a runner
        wrong read   numbers not in the key read at all
        frames right share of single-frame full-number reads that are in the key
      --brief prints the table only.
      """)
  }
  let key = AnswerKey(path: args.positional[0])
  let lo = args.options["start"].map(parseTime) ?? key.range?.0 ?? 0
  let hi = args.options["end"].map(parseTime) ?? key.range?.1 ?? .infinity
  func inRange(_ t: Double) -> Bool { t >= lo - 1e-6 && t <= hi + 1e-6 }

  print(String(format: "key: %d bibs, %d unsure · %@ – %@", key.bibs.count, key.unsure.count, formatTime(lo),
               hi.isFinite ? formatTime(hi) : "end"))
  var rows: [String] = []
  var details: [String] = []
  for path in args.positional.dropFirst() {
    let (name, d) = loadScan(path)
    let sightings = d.sightings.filter { inRange($0.from) || inRange($0.to) }
    let read = Set(sightings.map(\.bib))
    let listed = Set(sightings.filter { $0.label != "duplicate" }.map(\.bib))
    let missed = key.bibs.subtracting(read)
    // Right bibs the list hides: read, but every sighting was folded into another number.
    let hidden = key.bibs.intersection(read).subtracting(listed)
    let wrongRead = read.subtracting(key.bibs).subtracting(key.unsure)
    let wrongListed = wrongRead.intersection(listed)
    // Single-frame reads of full numbers: the finest measure of how often the reader is right.
    var right = 0, total = 0
    var readTimes: [String: [Double]] = [:]
    for f in d.frames where inRange(f.t) {
      for b in f.bibs where b.fragment != true && !key.unsure.contains(b.bib) {
        total += 1
        if key.bibs.contains(b.bib) { right += 1 }
      }
      for b in f.bibs { readTimes[b.bib, default: []].append(f.t) }
    }
    rows.append(name.padding(toLength: max(16, name.count), withPad: " ", startingAt: 0)
                + String(format: " %4d/%-3d %4d/%-3d %12d %10d   %5.1f%% (%d/%d)", key.bibs.intersection(listed).count, key.bibs.count,
                         key.bibs.intersection(read).count, key.bibs.count, wrongListed.count, wrongRead.count,
                         total > 0 ? 100 * Double(right) / Double(total) : 0, right, total))
    details.append("\n\(name)")
    details.append("  missed: " + (missed.isEmpty ? "–" : missed.sorted().joined(separator: " ")))
    if !hidden.isEmpty {
      details.append("  hidden (read, but only as a duplicate):")
      for bib in hidden.sorted() {
        let notes = Set(sightings.filter { $0.bib == bib }.map(\.note)).sorted().joined(separator: "; ")
        details.append("    \(bib)  \(notes)")
      }
    }
    details.append("  wrong (* = still listed):")
    for bib in wrongRead.sorted() {
      let ts = (readTimes[bib] ?? []).sorted()
      let labels = Set(sightings.filter { $0.bib == bib }.map(\.label)).sorted().joined(separator: ",")
      let at = ts.prefix(6).map { String(format: "%.1f", $0) }.joined(separator: " ") + (ts.count > 6 ? " …" : "")
      details.append("    \(wrongListed.contains(bib) ? "*" : " ") \(bib)  \(ts.count) read(s) [\(labels)]  at \(at)")
    }
  }
  print("scan               listed      read   wrong listed wrong read   frames right")
  rows.forEach { print($0) }
  if !args.switches.contains("brief") { details.forEach { print($0) } }
}

// MARK: - review

/// One candidate bib on the review page.
private struct Candidate {
  var bib: String
  var first = Double.infinity, last = -Double.infinity
  /// Frame reads per scan (and "ai").
  var reads: [String: Int] = [:]
  /// Sighting labels per scan.
  var labels: [String: [String]] = [:]
  var notes: [String] = []
  /// Best reads to show (time, box, confidence).
  var samples: [(t: Double, box: Box, confidence: Double)] = []
}

/// Frames read by an AI model, from the viewer's AI check (scans/<video>/ai/*.json).
private struct AIRun: Decodable {
  struct Read: Decodable { var number: String; var partial: Bool?; var confidence: Double?; var box: [Double]? }
  struct Frame: Decodable { var t: Double; var reads: [Read]? }
  var model: String?
  var frames: [Frame]
}

func runReview(_ raw: [String]) {
  let args = Args(raw, switches: [])
  applyBibOptions(args)
  guard args.positional.count >= 2, let videoPath = args.options["video"] else {
    die("""
      usage: bibwatch review <outDir> <scanDir> [<scanDir> …] --video <video> [--ai ai.json] [--start mm:ss] [--end mm:ss]

      Writes <outDir>/review.html: every bib any of the scans (or an AI check) read, with close-ups
      from the video, so you can mark each one right or wrong and save an answer key for
      `bibwatch score`. Close-ups are saved in <outDir>/crops (on this Mac only).
      """)
  }
  let outDir = args.positional[0]
  let lo = args.options["start"].map(parseTime) ?? 0
  let hi = args.options["end"].map(parseTime) ?? .infinity
  func inRange(_ t: Double) -> Bool { t >= lo - 1e-6 && t <= hi + 1e-6 }

  var cands: [String: Candidate] = [:]
  var scanNames: [String] = []
  for path in args.positional.dropFirst() {
    let (name, d) = loadScan(path)
    scanNames.append(name)
    for s in d.sightings where inRange(s.from) || inRange(s.to) {
      var c = cands[s.bib] ?? Candidate(bib: s.bib)
      c.labels[name, default: []].append(s.label)
      if !s.note.isEmpty, s.label == "duplicate" { c.notes.append("\(name): \(s.note)") }
      cands[s.bib] = c
    }
    for f in d.frames where inRange(f.t) {
      for b in f.bibs where cands[b.bib] != nil {
        cands[b.bib]!.reads[name, default: 0] += 1
        cands[b.bib]!.first = min(cands[b.bib]!.first, f.t)
        cands[b.bib]!.last = max(cands[b.bib]!.last, f.t)
        cands[b.bib]!.samples.append((f.t, b.box, b.confidence))
      }
    }
  }
  var aiName: String? = nil
  if let aiPath = args.options["ai"] {
    let run = readJSON(AIRun.self, aiPath)
    let name = "ai (\(run.model ?? "model"))"
    aiName = name
    for f in run.frames where inRange(f.t) {
      for r in f.reads ?? [] where r.partial != true && r.number.allSatisfy(\.isNumber) {
        let bib = normalizeBib(r.number)
        var c = cands[bib] ?? Candidate(bib: bib)
        c.reads[name, default: 0] += 1
        c.first = min(c.first, f.t)
        c.last = max(c.last, f.t)
        if let b = r.box, b.count == 4 { c.samples.append((f.t, Box(x0: b[0], y0: b[1], x1: b[2], y1: b[3]), (r.confidence ?? 0.5) * 0.9)) }
        cands[bib] = c
      }
    }
  }

  // Close-ups: up to 3 of the most confident reads, at least a second apart.
  try? FileManager.default.createDirectory(atPath: outDir + "/crops", withIntermediateDirectories: true)
  let video = VideoSource(path: videoPath)
  let ordered = cands.values.sorted { ($0.first, $0.bib) < ($1.first, $1.bib) }
  var crops: [String: [(file: String, t: Double)]] = [:]
  for (n, c) in ordered.enumerated() {
    progress("close-ups \(n + 1)/\(ordered.count)")
    var picked: [(t: Double, box: Box, confidence: Double)] = []
    for s in c.samples.sorted(by: { $0.confidence > $1.confidence }) where picked.count < 3 {
      if picked.allSatisfy({ abs($0.t - s.t) >= 1 }) { picked.append(s) }
    }
    for (i, s) in picked.sorted(by: { $0.t < $1.t }).enumerated() {
      autoreleasepool {
        guard let img = video.frame(at: s.t), let cut = closeUp(img, s.box) else { return }
        let file = "crops/\(c.bib)-\(i + 1).jpg"
        writeImage(cut, outDir + "/" + file, jpeg: true)
        crops[c.bib, default: []].append((file, s.t))
      }
    }
  }
  progressDone()

  let columns = scanNames + (aiName.map { [$0] } ?? [])
  let items: [[String: Any]] = ordered.map { c in
    [
      "bib": c.bib,
      "first": c.first.isFinite ? formatTime(c.first, tenths: true) : "",
      "last": c.last.isFinite ? formatTime(c.last, tenths: true) : "",
      "reads": columns.map { c.reads[$0] ?? 0 },
      "labels": columns.map { (c.labels[$0] ?? []).joined(separator: ", ") },
      "notes": c.notes,
      "crops": (crops[c.bib] ?? []).map { ["file": $0.file, "t": formatTime($0.t, tenths: true)] },
    ]
  }
  let data: [String: Any] = [
    "video": video.url.lastPathComponent,
    "range": "\(formatTime(lo))-\(hi.isFinite ? formatTime(hi) : formatTime(video.duration))",
    "columns": columns,
    "items": items,
  ]
  let json = String(data: try! JSONSerialization.data(withJSONObject: data), encoding: .utf8)!
  try? reviewHTML.replacingOccurrences(of: "/*DATA*/null", with: json)
    .write(toFile: outDir + "/review.html", atomically: true, encoding: .utf8)
  print("\(ordered.count) bibs to check · written: \(outDir)/review.html")
}

/// The bib and the body around it, enlarged so the digits are easy to check.
func closeUp(_ image: CGImage, _ b: Box) -> CGImage? {
  let fw = Double(image.width), fh = Double(image.height)
  let w = max((b.x1 - b.x0) * 3, 0.05), h = max((b.y1 - b.y0) * 4, 0.05 * fw / fh)
  let x0 = max(0, b.cx - w / 2), y0 = max(0, b.cy - h / 2)
  let rect = CGRect(x: x0 * fw, y: y0 * fh, width: min(w, 1 - x0) * fw, height: min(h, 1 - y0) * fh).integral
  guard let cut = image.cropping(to: rect) else { return nil }
  let outH = 240.0, outW = (rect.width / rect.height * outH).rounded()
  guard let ctx = CGContext(data: nil, width: Int(outW), height: Int(outH), bitsPerComponent: 8, bytesPerRow: 0,
                            space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return nil }
  ctx.interpolationQuality = .high
  ctx.draw(cut, in: CGRect(x: 0, y: 0, width: outW, height: outH))
  // Outline the read, so it's clear which number this is about.
  let sx = outW / rect.width, sy = outH / rect.height
  ctx.setStrokeColor(CGColor(red: 1, green: 0.85, blue: 0, alpha: 1))
  ctx.setLineWidth(2)
  ctx.stroke(CGRect(x: (b.x0 * fw - rect.minX) * sx - 3, y: outH - (b.y1 * fh - rect.minY) * sy - 3,
                    width: (b.x1 - b.x0) * fw * sx + 6, height: (b.y1 - b.y0) * fh * sy + 6))
  return ctx.makeImage()
}

func writeImage(_ image: CGImage, _ path: String, jpeg: Bool = false) {
  let type = (jpeg ? UTType.jpeg : UTType.png).identifier as CFString
  guard let dest = CGImageDestinationCreateWithURL(URL(fileURLWithPath: path) as CFURL, type, 1, nil) else { die("cannot write \(path)") }
  CGImageDestinationAddImage(dest, image, jpeg ? [kCGImageDestinationLossyCompressionQuality: 0.85] as CFDictionary : nil)
  guard CGImageDestinationFinalize(dest) else { die("cannot write \(path)") }
}

// MARK: - mosaic

func runMosaic(_ raw: [String]) {
  let args = Args(raw, switches: [])
  applyBibOptions(args)
  guard args.positional.count >= 2, let at = args.options["at"] else {
    die("""
      usage: bibwatch mosaic <video> <out.png> --at seconds [--key key.txt] [--max-bib 250] [--digits 4-6]

      What "Only look for people" reads in one frame: the torsos picture it sends to text
      recognition, with every number it read outlined (green = in the key, red = not, yellow = no key
      or unsure). The reads are printed as JSON.
      """)
  }
  let key = args.options["key"].map { AnswerKey(path: $0) }
  let maxBib = Int(args.double("max-bib", 250))
  let video = VideoSource(path: args.positional[0])
  let t = parseTime(at)
  guard let img = video.frame(at: t) else { die("cannot read frame") }
  let humans = VNDetectHumanRectanglesRequest()
  humans.upperBodyOnly = false
  try? VNImageRequestHandler(cgImage: img, options: [:]).perform([humans])
  let people = (humans.results ?? []).map { Box(visionRect: $0.boundingBox) }
  guard let m = makeMosaic(img, torsoRegions(img, people), tileHeight: mosaicTileHeight) else { die("no readable people at \(at)") }
  let reads = readMosaic(m, frameWidth: Double(img.width), frameHeight: Double(img.height), maxBib: maxBib)

  let W = m.image.width, H = m.image.height
  guard let ctx = CGContext(data: nil, width: W, height: H, bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(),
                            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { die("cannot draw") }
  ctx.draw(m.image, in: CGRect(x: 0, y: 0, width: W, height: H))
  ctx.setLineWidth(3)
  for (read, r) in reads {
    let color: CGColor
    if let k = key, !k.unsure.contains(read.bib) {
      color = k.bibs.contains(read.bib) ? CGColor(red: 0, green: 0.9, blue: 0.2, alpha: 1) : CGColor(red: 1, green: 0.1, blue: 0.1, alpha: 1)
    } else {
      color = CGColor(red: 1, green: 0.85, blue: 0, alpha: 1)
    }
    ctx.setStrokeColor(color)
    ctx.stroke(CGRect(x: r.minX - 2, y: Double(H) - r.maxY - 2, width: r.width + 4, height: r.height + 4))
  }
  guard let out = ctx.makeImage() else { die("cannot draw") }
  writeImage(out, args.positional[1])

  let rows: [[String: Any]] = reads.map { read, r in
    let tile = m.tiles.firstIndex { $0.rect.contains(CGPoint(x: r.midX, y: r.midY)) } ?? -1
    // How much the torso was enlarged (>1) or shrunk (<1) in the mosaic.
    let scale = tile >= 0 ? m.tiles[tile].rect.height / m.tiles[tile].crop.height : 0
    return ["bib": read.bib, "confidence": (read.confidence * 100).rounded() / 100, "fragment": read.fragment == true, "tile": tile,
            "scale": Decimal(string: String(format: "%.1f", scale))!, "digitsPx": Int(r.height / max(scale, 1e-6)),
            "inKey": key.map { $0.bibs.contains(read.bib) ? "yes" : $0.unsure.contains(read.bib) ? "unsure" : "no" } ?? ""]
  }
  let summary: [String: Any] = ["t": t, "people": people.count, "tiles": m.tiles.count, "mosaic": [W, H], "reads": rows]
  print(String(data: try! JSONSerialization.data(withJSONObject: summary, options: [.sortedKeys]), encoding: .utf8)!)
}

// MARK: - Review page

private let reviewHTML = #"""
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Bib review</title>
<style>
  body { font: 14px/1.4 -apple-system, system-ui, sans-serif; margin: 24px; color: #1a1a1a; background: #f6f6f4; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .sub { color: #666; margin-bottom: 16px; }
  .bar { position: sticky; top: 0; background: #f6f6f4; padding: 8px 0; z-index: 1; display: flex; gap: 16px; align-items: center; border-bottom: 1px solid #ddd; }
  .card { background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 12px; margin: 12px 0; display: flex; gap: 16px; }
  .card.right { border-color: #2e9d4f; box-shadow: inset 4px 0 #2e9d4f; }
  .card.wrong { border-color: #d33; box-shadow: inset 4px 0 #d33; }
  .card.unsure { border-color: #d9a400; box-shadow: inset 4px 0 #d9a400; }
  .info { width: 250px; flex: none; }
  .bib { font-size: 28px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .crops { display: flex; gap: 8px; overflow-x: auto; }
  .crops figure { margin: 0; }
  .crops img { height: 240px; border-radius: 4px; display: block; }
  .crops figcaption { color: #666; font-size: 12px; }
  table { border-collapse: collapse; margin: 6px 0; font-size: 12px; }
  td { padding: 1px 6px 1px 0; }
  .note { color: #666; font-size: 12px; }
  .buttons { display: flex; gap: 6px; margin-top: 8px; }
  button { font: inherit; padding: 4px 10px; border-radius: 6px; border: 1px solid #bbb; background: #fff; cursor: pointer; }
  button.on[data-v=right] { background: #2e9d4f; color: #fff; border-color: #2e9d4f; }
  button.on[data-v=wrong] { background: #d33; color: #fff; border-color: #d33; }
  button.on[data-v=unsure] { background: #d9a400; color: #fff; border-color: #d9a400; }
  textarea { width: 100%; font: 13px ui-monospace, monospace; }
  .done { background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 12px; margin-top: 24px; }
</style>
</head>
<body>
<script>const DATA = /*DATA*/null;</script>
<h1>Bib review — <span id="video"></span></h1>
<div class="sub">
  Each card is a number that at least one scan read. Look at the close-ups (the yellow box is what was read) and mark it:
  <b>Right</b> if a runner in this stretch wears that exact bib, <b>Wrong</b> if not (a misread digit, a sign, a shirt logo),
  <b>Not sure</b> if you can't tell. Shortcut: 1 / 2 / 3 for the card under the mouse. Your marks are kept in this browser.
</div>
<div class="bar"><span id="count"></span><a href="#done">Save key ↓</a></div>
<div id="cards"></div>
<div class="done" id="done">
  <p><b>Bibs you saw in this stretch that aren't listed above</b> (one per line or separated by spaces — watch the video for runners no scan read):</p>
  <textarea id="extra" rows="3"></textarea>
  <p><b>Answer key</b> — save as a .txt file for <code>bibwatch score</code>:</p>
  <textarea id="key" rows="12" readonly></textarea>
  <p><button id="download">Download key.txt</button></p>
</div>
<script>
const store = 'bibreview:' + DATA.video + ':' + DATA.range;
const marks = JSON.parse(localStorage.getItem(store) || '{}');
const cards = document.getElementById('cards');
const extra = document.getElementById('extra');
extra.value = marks.__extra || '';
document.getElementById('video').textContent = DATA.video + ' (' + DATA.range + ')';
let hovered = null;

for (const it of DATA.items) {
  const card = document.createElement('div');
  card.className = 'card';
  const rows = DATA.columns.map((c, i) =>
    `<tr><td>${c}</td><td>${it.reads[i] ? it.reads[i] + ' read(s)' : '—'}</td><td>${it.labels[i] || ''}</td></tr>`).join('');
  card.innerHTML = `
    <div class="info">
      <div class="bib">${it.bib}</div>
      <div class="note">${it.first} – ${it.last}</div>
      <table>${rows}</table>
      ${it.notes.map(n => `<div class="note">${n}</div>`).join('')}
      <div class="buttons">
        <button data-v="right">Right</button><button data-v="wrong">Wrong</button><button data-v="unsure">Not sure</button>
      </div>
    </div>
    <div class="crops">${it.crops.map(c => `<figure><img src="${c.file}" loading="lazy"><figcaption>${c.t}</figcaption></figure>`).join('')
      || '<span class="note">No close-up available</span>'}</div>`;
  const set = v => { marks[it.bib] = marks[it.bib] === v ? undefined : v; render(); };
  card.querySelectorAll('button').forEach(b => b.onclick = () => set(b.dataset.v));
  card.onmouseenter = () => hovered = set;
  card.dataset.bib = it.bib;
  cards.appendChild(card);
}
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'TEXTAREA' || !hovered) return;
  const v = { '1': 'right', '2': 'wrong', '3': 'unsure' }[e.key];
  if (v) hovered(v);
});
extra.oninput = render;

function render() {
  marks.__extra = extra.value;
  localStorage.setItem(store, JSON.stringify(marks));
  let done = 0;
  for (const card of cards.children) {
    const v = marks[card.dataset.bib];
    card.className = 'card' + (v ? ' ' + v : '');
    card.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
    if (v) done++;
  }
  document.getElementById('count').textContent = `${done} of ${DATA.items.length} marked`;
  const right = DATA.items.filter(i => marks[i.bib] === 'right').map(i => i.bib);
  const unsure = DATA.items.filter(i => marks[i.bib] === 'unsure').map(i => i.bib + '?');
  const added = extra.value.split(/[\s,]+/).filter(Boolean);
  const unmarked = DATA.items.filter(i => !marks[i.bib]).length;
  document.getElementById('key').value = [
    `# video: ${DATA.video}`,
    `# range: ${DATA.range}`,
    `# checked by hand ${new Date().toISOString().slice(0, 10)}` + (unmarked ? ` — ${unmarked} candidate(s) not marked yet` : ''),
    ...right, ...(added.length ? ['# not read by any scan', ...added] : []), ...(unsure.length ? ['# not sure', ...unsure] : []),
  ].join('\n') + '\n';
}
document.getElementById('download').onclick = () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([document.getElementById('key').value], { type: 'text/plain' }));
  a.download = 'key.txt';
  a.click();
};
render();
</script>
</body>
</html>
"""#
