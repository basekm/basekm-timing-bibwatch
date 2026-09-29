import Foundation

struct OverlayFrame: Codable {
  var t: Double
  var bibs: [BibRead]
  /// Present (possibly empty) for fine-pass frames, which also detect people; nil for coarse-only frames.
  var people: [Box]?
}

struct Sighting: Codable {
  var bib: String
  var target: Bool
  var segment: Int
  var from: Double
  var to: Double
  var coarseFrames: Int
  /// crossed (000) | viewed (001) | near-mat (002) | passing (003) | camera-moving (004) |
  /// duplicate (005) | needs-scan (not decided yet — frames still to be read). See `tagCode`.
  var label: String
  var cross: Double?
  var crossClock: String?
  var reads: Int
  var tracked: Int
  var note: String
  /// Where the runner was relative to the mat while the bib was readable:
  /// background | before-mat | on-mat | past-mat (nil when no mat / not tracked).
  var zone: String? = nil
  /// toward (the camera) | away | still (nil when not tracked).
  var direction: String? = nil
  /// Bib design (template) the number was read with, when templates are used.
  var template: String? = nil
  /// false when the bib isn't in the race's participant list (--registered); nil when no list given.
  var registered: Bool? = nil
  /// Reads of the full number (not 3-digit fragments) — decides which bib owns a crossing.
  /// Optional so scans saved before this field existed still load.
  var fullReads: Int? = nil
}

struct ScanSettings: Codable, Equatable {
  var every: Double
  var fineFps: Double
  var pad: Double
  var maxBib: Int
  var colorCheck: Bool
  /// Bib template in use (name + its measured values), nil = whole-frame reading.
  var template: String? = nil
  /// "people-first": text is read only on the torsos of people found in the frame.
  var reader: String? = nil
  /// Bib digits "MIN-MAX" when not the classic 4; lowest bib when above 1.
  var digits: String? = nil
  var minBib: Int? = nil
}

/// Everything the viewer needs, and everything a later scan can reuse.
/// Frame reads (the slow part) accumulate across runs; sightings/crossings (the fast part)
/// are recomputed from them — by this scanner and by the viewer whenever mats or camera
/// segments change.
struct Detections: Codable {
  var version = 2
  var video: String
  var duration: Double
  /// Reader (wall-clock) time at video 0:00, if known ("HH:MM:SS" or "HH:MM:SS.s").
  var clock: String?
  var maxBib: Int
  var colorCheck: Bool
  var settings: ScanSettings?
  /// Time ranges already covered by the coarse pass (on the `every` grid).
  var coarseDone: [[Double]]?
  /// Coarse-pass times at which each bib was read.
  var coarseHits: [String: [Double]]?
  var targets: [String]?
  /// The race's registered bib numbers (--registered), for the "not registered" tag.
  var registered: [String]?
  var segments: [Segment]
  var frames: [OverlayFrame]
  var sightings: [Sighting]
  /// Set while a scan is still running (this file is a progress checkpoint).
  var scanning: Bool? = nil
  /// Video time up to which pass 1 has read (checkpoints only).
  var scannedUntil: Double? = nil
}

/// Set by SIGTERM (Cancel in the viewer): stop after the current frame and save.
var scanStopRequested = false

// MARK: - Decisions (mirrored in viewer/app.js → buildSightings / evaluate)

struct Window { var bib: String; var from: Double; var to: Double; var count: Int; var seg: Segment }

/// A bib's coarse hits less than 10 s apart form one sighting, never spanning two camera segments.
func buildWindows(_ hits: [String: [Double]], segments: [Segment]) -> [Window] {
  func segment(at t: Double) -> Segment { segments.first { t >= $0.from && t < $0.to } ?? segments.last! }
  var windows: [Window] = []
  for (bib, ts) in hits {
    var cur: Window? = nil
    for x in ts.sorted() {
      let seg = segment(at: x)
      if var c = cur, x - c.to <= 10, c.seg.index == seg.index { c.to = x; c.count += 1; cur = c; continue }
      if let c = cur { windows.append(c) }
      cur = Window(bib: bib, from: x, to: x, count: 1, seg: seg)
    }
    if let c = cur { windows.append(c) }
  }
  return windows.sorted { $0.from < $1.from }
}

/// Decide what a sighting was, from the fine-pass frames around it.
func evaluate(_ w: Window, frames allFrames: [OverlayFrame], pad: Double, fineFps: Double,
              target: Bool, clock: Double?) -> Sighting {
  var s = Sighting(bib: w.bib, target: target, segment: w.seg.index, from: w.from, to: w.to,
                   coarseFrames: w.count, label: "viewed", cross: nil, crossClock: nil, reads: 0, tracked: 0, note: "")
  // Every bib in front of the camera is captured and decided the same way, camera moving or
  // not: a "moving" stretch simply has no mat, so its bibs are tagged 001 Viewed.

  let lo = max(w.seg.from, w.from - pad), hi = min(w.seg.to, w.to + pad)
  let frames = allFrames.filter { $0.people != nil && $0.t >= lo - 1e-6 && $0.t <= hi + 1e-6 }
  let designs = frames.flatMap { $0.bibs.filter { $0.bib == w.bib }.compactMap(\.template) }
  s.template = Dictionary(grouping: designs, by: { $0 }).max { $0.value.count < $1.value.count }?.key
  let expected = max(1, Int(((hi - lo) * fineFps).rounded(.down)))
  if Double(frames.count) < 0.8 * Double(expected) {
    s.label = "needs-scan"; s.note = "not enough frames read here yet — run the scan"; return s
  }

  // Person wearing the bib where it's readable: smallest person box around the bib.
  var person: [Int: (box: Box, read: Bool)] = [:]
  for (k, fr) in frames.enumerated() {
    guard let hit = fr.bibs.first(where: { $0.bib == w.bib }) else { continue }
    s.reads += 1
    if hit.fragment != true { s.fullReads = (s.fullReads ?? 0) + 1 }
    if let p = (fr.people ?? []).filter({ $0.contains(hit.box.cx, hit.box.cy) }).min(by: { $0.area < $1.area }) {
      person[k] = (p, true)
    }
  }
  // Bibs usually only become readable close to the camera, so follow the nearest
  // person box both forwards and backwards from the readable frames.
  func follow(_ order: [Int]) {
    var last: Box? = nil
    for k in order {
      if let p = person[k], p.read { last = p.box; continue }
      guard let l = last else { continue }
      if let p = (frames[k].people ?? []).min(by: { hypot($0.cx - l.cx, $0.y1 - l.y1) < hypot($1.cx - l.cx, $1.y1 - l.y1) }),
         hypot(p.cx - l.cx, p.y1 - l.y1) < 0.10 {
        if person[k] == nil { person[k] = (p, false) }
        last = p
      } else {
        last = nil
      }
    }
  }
  follow(Array(frames.indices))
  follow(Array(frames.indices.reversed()))
  let keys = person.keys.sorted()
  s.tracked = keys.count

  if s.reads == 0 || person.values.allSatisfy({ !$0.read }) {
    s.label = "viewed"; s.note = "bib read, but no person found around it"
    return s
  }
  // Direction: are the feet moving down the frame (toward the camera), up, or staying put?
  let feet = keys.map { person[$0]!.box.y1 }
  let quarter = max(1, feet.count / 4)
  let trend = feet.suffix(quarter).reduce(0, +) / Double(quarter) - feet.prefix(quarter).reduce(0, +) / Double(quarter)
  s.direction = trend > 0.03 ? "toward" : trend < -0.03 ? "away" : "still"

  guard let mat = w.seg.mat else { s.label = "viewed"; s.note = "no mat for this camera position"; return s }
  let track = keys.map { (t: frames[$0].t, x: person[$0]!.box.cx, depth: mat.depth(person[$0]!.box.cx, person[$0]!.box.y1)) }
  // Zone: typical position while the bib was readable.
  let readDepths = keys.filter { person[$0]!.read }.map { mat.depth(person[$0]!.box.cx, person[$0]!.box.y1) }.sorted()
  if !readDepths.isEmpty {
    let d = readDepths[readDepths.count / 2]
    s.zone = d < -0.25 ? "background" : d < -0.04 ? "before-mat" : d <= 0.02 ? "on-mat" : "past-mat"
  }
  // Crossing: feet move from clearly before the mat's near edge onto/over it, toward the camera.
  var sawBefore = false
  for k in track.indices {
    let p = track[k]
    if p.depth < -0.04 { sawBefore = true }
    if sawBefore, k > 0, p.depth >= 0, p.x >= mat.minX - 0.02, p.x <= mat.maxX + 0.02 {
      let q = track[k - 1]
      let f = (0 - q.depth) / max(p.depth - q.depth, 1e-6)
      s.cross = q.t + (p.t - q.t) * min(max(f, 0), 1)
      break
    }
  }
  let near = track.filter { $0.depth >= -0.06 }
  let nearSpan = (near.map(\.t).max() ?? 0) - (near.map(\.t).min() ?? 0)
  let deepest = track.map(\.depth).max() ?? -1
  if s.cross != nil {
    s.label = "crossed"
    if nearSpan > 5 { s.note = "stayed near the mat afterwards" }
  } else if !near.isEmpty && nearSpan >= 2 {
    s.label = "near-mat"; s.note = "on or near the mat without a clear crossing"
  } else if deepest < -0.06 {
    s.label = "passing"; s.note = "never came close to the mat"
  } else if track.count < 4 {
    s.note = "too few tracked frames"
  }
  if let c = s.cross, let clk = clock { s.crossClock = formatTime(clk + c, tenths: true) }
  return s
}

// MARK: - Scan

func runScan(_ raw: [String]) {
  let args = Args(raw, switches: ["no-color", "fresh", "people-first", "profile"])
  Profile.enabled = args.switches.contains("profile")
  Profile.begin()
  applyBibOptions(args)
  guard args.positional.count >= 2 else {
    die("""
      usage: bibwatch scan <video> <outDir> [--targets targets.txt] [--segments segments.json | --mat X0,Y0,X1,Y1]
                           [--clock HH:MM:SS] [--every 0.5] [--fine-fps 10] [--pad 4] [--start mm:ss] [--end mm:ss]
                           [--max-bib 250] [--min-bib 1] [--digits 4-6] [--no-color] [--template template.json …] [--registered bibs.txt]
                           [--from mm:ss] [--fresh] [--people-first] [--profile] [--progress json]

      Frame reads are kept in <outDir>/detections.json and reused by later scans of the same
      video with the same settings, so re-running (e.g. after marking mats) only reads new frames.
      --fresh ignores what was read before.
      """)
  }
  let videoPath = args.positional[0], outDir = args.positional[1]
  progressJSON = args.options["progress"] == "json"
  let templates: [BibTemplate] = (args.all["template"] ?? []).map { readJSON(BibTemplate.self, $0) }
  let templateID = templates.isEmpty ? nil : templates.map { t in
    String(format: "%@ h%.1f±%.0f s%.2f v%.2f w%.2f/%.2f d%.4f-%.4f r%d-%d", t.name, t.bandHue, t.hueTolerance, t.bandSatMin, t.bandValMin,
           t.digitSatMax, t.digitValMin, t.digitHeightMin, t.digitHeightMax, t.minBib ?? 1, t.maxBib)
  }.joined(separator: " | ")
  let settings = ScanSettings(every: args.double("every", 0.5), fineFps: args.double("fine-fps", 10), pad: args.double("pad", 4),
                              maxBib: templates.map(\.maxBib).max() ?? Int(args.double("max-bib", 250)), colorCheck: !args.switches.contains("no-color"),
                              template: templateID, reader: args.switches.contains("people-first") ? "people-first" : nil,
                              digits: BibText.isClassic ? nil : "\(BibText.minDigits)-\(BibText.maxDigits)",
                              minBib: BibText.minBib > 1 ? BibText.minBib : nil)
  let clockSeconds = args.options["clock"].map(parseTime)
  let targets: Set<String> = args.options["targets"].map { path in
    Set((try? String(contentsOfFile: path, encoding: .utf8))?
      .split(whereSeparator: { $0.isNewline || $0 == " " || $0 == "," })
      .map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty } ?? [])
  } ?? []

  // Registered bib numbers (one per line): bibs not in it are tagged "not registered".
  let registered: Set<String>? = args.options["registered"].map { path in
    Set((try? String(contentsOfFile: path, encoding: .utf8))?
      .split(whereSeparator: { $0.isNewline || $0 == " " || $0 == "," })
      .map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty } ?? [])
  }
  let video = VideoSource(path: videoPath)
  let startT = args.options["start"].map(parseTime) ?? 0
  let endT = min(args.options["end"].map(parseTime) ?? video.duration, video.duration)

  // Camera segments: from `bibwatch segments` (mats marked in the viewer), or one fixed
  // segment for the whole video with --mat.
  var segments: [Segment]
  if let path = args.options["segments"] {
    segments = readJSON(SegmentsFile.self, path).segments
  } else {
    var mat: MatLine? = nil
    if let m = args.options["mat"] {
      let p = m.split(separator: ",").compactMap { Double($0) }
      switch p.count {
      case 3: mat = MatLine(x0: p[1], y0: p[0], x1: p[2], y1: p[0])   // legacy TOP,X0,X1
      case 4: mat = MatLine(x0: p[0], y0: p[1], x1: p[2], y1: p[3])
      default: die("--mat needs X0,Y0,X1,Y1")
      }
    }
    segments = [Segment(index: 1, from: 0, to: video.duration, kind: "fixed", refTime: 0, mat: mat)]
  }
  try? FileManager.default.createDirectory(atPath: outDir, withIntermediateDirectories: true)
  let outPath = outDir + "/detections.json"

  func key(_ t: Double) -> Int { Int((t * 1000).rounded()) }

  // ---- Reuse what earlier scans of this video already read ----
  var overlay: [Int: OverlayFrame] = [:]
  var coarseDone: [[Double]] = []
  var coarseHits: [String: [Double]] = [:]
  if !args.switches.contains("fresh"), FileManager.default.fileExists(atPath: outPath) {
    // A scan that can't be read (older format, damaged) is not an error: just read afresh.
    if let old = tryReadJSON(Detections.self, outPath), old.video == video.url.lastPathComponent, old.settings == settings {
      for f in old.frames { overlay[key(f.t)] = f }
      coarseDone = old.coarseDone ?? []
      coarseHits = old.coarseHits ?? [:]
      FileHandle.standardError.write("reusing \(old.frames.count) frames read by earlier scans\n".data(using: .utf8)!)
    } else {
      FileHandle.standardError.write("earlier scan used other settings or an older format — starting fresh\n".data(using: .utf8)!)
    }
  }
  func coarseCovered(_ t: Double) -> Bool { coarseDone.contains { t >= $0[0] - 1e-6 && t < $0[1] - 1e-6 } }
  var rejected = 0
  var coarseRead = 0, fineRead = 0
  let every = settings.every
  let pad = settings.pad
  let step = 1 / settings.fineFps

  // Stop cleanly (Cancel in the viewer sends SIGTERM): save what was read, then exit.
  signal(SIGTERM, SIG_IGN)
  let stopSource = DispatchSource.makeSignalSource(signal: SIGTERM, queue: .global())
  stopSource.setEventHandler { scanStopRequested = true }
  stopSource.resume()

  // ---- Decisions + save (also used for progress checkpoints) ----
  var scannedUntil = startT
  func save(final: Bool) -> [Sighting] {
    let frames = overlay.values.sorted { $0.t < $1.t }.map { f -> OverlayFrame in
      var f = f; f.t = (f.t * 1000).rounded() / 1000; return f
    }
    let hits = coarseHits.mapValues { Array(Set($0.map { ($0 * 1000).rounded() / 1000 })).sorted() }
    let sightings = oneBibPerCrossing(buildWindows(hits, segments: segments).map { w -> Sighting in
      var s = evaluate(w, frames: frames, pad: pad, fineFps: settings.fineFps, target: targets.contains(w.bib), clock: clockSeconds)
      s.registered = registered.map { $0.contains(w.bib) }
      return s
    })
    var d = Detections(video: video.url.lastPathComponent, duration: video.duration,
                       clock: clockSeconds.map { formatTime($0, tenths: true) }, maxBib: settings.maxBib,
                       colorCheck: settings.colorCheck, settings: settings, coarseDone: mergeRanges(coarseDone),
                       coarseHits: hits, targets: targets.sorted(), registered: registered.map { $0.sorted() }, segments: segments,
                       frames: frames, sightings: sightings)
    d.scanning = final ? nil : true
    d.scannedUntil = final ? nil : (scannedUntil * 10).rounded() / 10
    timed("save") { writeJSON(d, outPath) }   // atomic: the viewer never sees a half-written file
    return sightings
  }

  // ---- Scan in chunks of video time, so results fill in while scanning ----
  // For each chunk: pass 1 reads bibs every `every` s; pass 2 follows runners (10 fps) around
  // every sighting that can't grow any more (its last read is > 10 s before the chunk end).
  // A checkpoint is saved every ~30 s of work (and when stopped), and the viewer reloads it.
  var grid: [Double] = []
  var k = (startT / every).rounded(.up)
  while k * every < endT { grid.append(k * every); k += 1 }
  let chunk = args.double("chunk", 60)
  let started = Date()
  var lastSave = Date()
  var fineDone = Set<String>()   // windows already followed ("bib@from")
  let totalSpan = max(endT - startT, 0.001)
  // --from T: start at T (e.g. where the viewer's playhead is), go to the end, then wrap round
  // and scan the beginning. Already-read parts are skipped wherever they are.
  let from = min(max(args.options["from"].map(parseTime) ?? startT, startT), endT)
  var chunks: [(Double, Double)] = []
  var c0 = from
  while c0 < endT { chunks.append((c0, min(endT, c0 + chunk))); c0 += chunk }
  c0 = startT
  while c0 < from { chunks.append((c0, min(from, c0 + chunk))); c0 += chunk }
  var processed = 0.0   // seconds of video covered so far (for progress)

  func followClosedWindows(upTo limit: Double) {
    let all = buildWindows(coarseHits, segments: [Segment(index: 1, from: 0, to: video.duration, kind: "fixed", refTime: 0, mat: nil)])
    for w in all where w.to + 10 < limit || limit >= endT {
      let id = "\(w.bib)@\(w.from)"
      if fineDone.contains(id) || scanStopRequested { continue }
      var ft = max(0, w.from - pad)
      let fEnd = min(video.duration, w.to + pad)
      while ft <= fEnd + 1e-9 && !scanStopRequested {
        let kk = key((ft / step).rounded() * step)
        if overlay[kk]?.people == nil {
          autoreleasepool {
            if let img = video.frame(at: Double(kk) / 1000) {
              let r = readFrame(img, people: true, colorCheck: settings.colorCheck, maxBib: settings.maxBib, templates: templates,
                                peopleFirst: settings.reader == "people-first")
              rejected += r.rejectedByColor
              overlay[kk] = OverlayFrame(t: Double(kk) / 1000, bibs: r.bibs, people: r.people)
              fineRead += 1
            }
          }
        }
        ft += step
      }
      if !scanStopRequested { fineDone.insert(id) }
    }
  }

  for (ci, (chunkStart, chunkEnd)) in chunks.enumerated() where !scanStopRequested {
    let lastChunk = ci == chunks.count - 1
    // Pass 1 for this chunk.
    for t in grid where t >= chunkStart - 1e-9 && t < chunkEnd - 1e-9 && !coarseCovered(t) {
      if scanStopRequested { break }
      autoreleasepool {
        guard let img = video.frame(at: t) else { return }
        let r = readFrame(img, people: false, colorCheck: settings.colorCheck, maxBib: settings.maxBib, templates: templates,
                          peopleFirst: settings.reader == "people-first")
        rejected += r.rejectedByColor
        if !r.bibs.isEmpty, overlay[key(t)] == nil { overlay[key(t)] = OverlayFrame(t: t, bibs: r.bibs, people: nil) }
        for b in r.bibs where !(coarseHits[b.bib]?.contains(t) ?? false) { coarseHits[b.bib, default: []].append(t) }
      }
      coarseRead += 1
      scannedUntil = t + every
      coarseDone.append([t, t + every])
      if coarseRead % 20 == 0 {
        coarseDone = mergeRanges(coarseDone)
        let elapsed = Date().timeIntervalSince(started)
        let doneFrac = min(1, (processed + (scannedUntil - chunkStart)) / totalSpan)
        let eta = doneFrac > 0.02 ? elapsed / doneFrac * (1 - doneFrac) : nil
        progress(String(format: "scan %@ / %@", formatTime(scannedUntil), formatTime(endT)),
                 phase: "scan", done: processed + (scannedUntil - chunkStart), total: totalSpan, eta: eta, at: scannedUntil)
      }
    }
    if scanStopRequested { break }
    scannedUntil = chunkEnd
    processed += chunkEnd - chunkStart
    coarseDone = mergeRanges(coarseDone)
    // Pass 2 for sightings that are complete by now (everything, after the last chunk).
    followClosedWindows(upTo: lastChunk ? endT : chunkEnd)
    if scanStopRequested { break }
    if Date().timeIntervalSince(lastSave) >= args.double("checkpoint", 30) && !lastChunk {
      _ = save(final: false)
      lastSave = Date()
      progress("checkpoint saved", phase: "checkpoint", done: processed, total: totalSpan)
    }
  }
  progressDone()

  if scanStopRequested {
    _ = save(final: false)
    print("stopped at \(formatTime(scannedUntil)) — everything read so far is saved; Run scan again to continue")
    exit(0)
  }
  let sightings = save(final: true)
  let frames = overlay.values

  var csv = "bib,is_target,registered,segment,seen_from,seen_to,coarse_frames,tag_code,label,zone,direction,cross_video,cross_clock,reads,tracked,note\n"
  for s in sightings.sorted(by: { ($0.bib, $0.from) < ($1.bib, $1.from) }) {
    csv += "\(s.bib),\(s.target ? "yes" : ""),\(s.registered.map { $0 ? "yes" : "no" } ?? ""),\(s.segment),\(formatTime(s.from)),\(formatTime(s.to)),\(s.coarseFrames),\(tagCode(s.label)),\(s.label),\(s.zone ?? ""),\(s.direction ?? ""),"
    csv += "\(s.cross.map { formatTime($0, tenths: true) } ?? ""),\(s.crossClock ?? ""),\(s.reads),\(s.tracked),\(s.note)\n"
  }
  try? csv.write(toFile: outDir + "/crossings.csv", atomically: true, encoding: .utf8)

  let counts = Dictionary(grouping: sightings, by: \.label).mapValues(\.count)
  print("pass 1: read \(coarseRead) new frame(s) · pass 2: read \(fineRead) new frame(s) · \(frames.count) frames kept · \(rejected) reads rejected by bib-colour check")
  print("\(sightings.count) sightings: " + counts.sorted { $0.key < $1.key }.map { "\($0.key)=\($0.value)" }.joined(separator: " "))
  let targetHits = sightings.filter(\.target)
  if !targets.isEmpty { print("target sightings: \(targetHits.count)") }
  for s in targetHits.sorted(by: { $0.from < $1.from }) {
    print("  \(s.bib) seen \(formatTime(s.from)): \(s.label)" + (s.cross.map { " at \(formatTime($0, tenths: true))" } ?? "") + (s.crossClock.map { " (\($0))" } ?? ""))
  }
  print("written: \(outPath), \(outDir)/crossings.csv")
  Profile.report()
}

/// One crossing = one bib. When several sightings "cross" within a second of each other, they
/// are almost always one runner read several ways ("0109" / "010", "0059" / "0159"): keep the
/// one with the most full-number reads (then most reads), mark the rest as duplicates.
func oneBibPerCrossing(_ input: [Sighting]) -> [Sighting] {
  var out = input
  let crossed = out.indices.filter { out[$0].label == "crossed" && out[$0].cross != nil }.sorted { out[$0].cross! < out[$1].cross! }
  var i = 0
  while i < crossed.count {
    var group = [crossed[i]]
    while i + group.count < crossed.count, out[crossed[i + group.count]].cross! - out[group.last!].cross! <= 1.0 {
      group.append(crossed[i + group.count])
    }
    if group.count > 1 {
      let keep = group.max { (out[$0].fullReads ?? 0, out[$0].reads) < (out[$1].fullReads ?? 0, out[$1].reads) }!
      for g in group where g != keep {
        out[g].label = "duplicate"
        out[g].note = "same crossing as \(out[keep].bib) (read as \(out[g].bib))"
      }
    }
    i += group.count
  }
  return out
}

/// Numbered automatic tags (mirrored in viewer/app.js → AUTO_TAGS).
func tagCode(_ label: String) -> String {
  ["crossed": "000", "viewed": "001", "near-mat": "002", "passing": "003", "camera-moving": "004", "duplicate": "005"][label] ?? ""
}

func mergeRanges(_ ranges: [[Double]]) -> [[Double]] {
  let sorted = ranges.sorted { $0[0] < $1[0] }
  var out: [[Double]] = []
  for r in sorted {
    if let last = out.last, r[0] <= last[1] + 1e-6 { out[out.count - 1][1] = max(last[1], r[1]) } else { out.append(r) }
  }
  return out
}
