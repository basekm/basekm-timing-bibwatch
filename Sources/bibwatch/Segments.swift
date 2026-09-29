import Foundation

/// Finds where the camera was moved, by comparing the static upper part of the frame
/// (banner, buildings, sky) over time. People passing close to the lens cause a short
/// spike that returns to the same scene — that's treated as occlusion, not a move.
func runSegments(_ raw: [String]) {
  let args = Args(raw, switches: ["debug"])
  progressJSON = args.options["progress"] == "json"
  guard args.positional.count >= 2 else {
    die("usage: bibwatch segments <video> <out segments.json> [--step 1] [--move 0.20] [--same 0.25] [--percentile 0.10] [--settle 4] [--min-fixed 15] [--debug]")
  }
  let videoPath = args.positional[0], outPath = args.positional[1]
  let step = args.double("step", 1.0)
  let moveThreshold = args.double("move", 0.20)
  let sameThreshold = args.double("same", 0.25)
  let settleSamples = Int(args.double("settle", 4))
  let driftSamples = 5

  let video = VideoSource(path: videoPath, maxWidth: 320)
  let started = Date()

  // Whole frame as a mean/contrast-normalised luma grid (normalising cancels the slow
  // brightening at dawn), compared cell by cell. People near the lens change *some*
  // cells; a camera move changes almost *all* of them — so the frame difference is a
  // low percentile of the per-cell differences, which ignores partial occlusion.
  let cols = 64, rows = 36, cell = 4
  let percentile = args.double("percentile", 0.10)
  func signature(at t: Double) -> [Double]? {
    guard let img = video.frame(at: t), let px = Pixels(img) else { return nil }
    let v = px.luma(cols: cols, rows: rows, top: 0.0, bottom: 1.0)
    let mean = v.reduce(0, +) / Double(v.count)
    let sd = max(sqrt(v.map { ($0 - mean) * ($0 - mean) }.reduce(0, +) / Double(v.count)), 0.02)
    return v.map { ($0 - mean) / sd }
  }
  func diff(_ a: [Double], _ b: [Double], percentile: Double = percentile) -> Double {
    var cells: [Double] = []
    for cy in stride(from: 0, to: rows, by: cell) {
      for cx in stride(from: 0, to: cols, by: cell) {
        var sum = 0.0
        for y in cy..<(cy + cell) { for x in cx..<(cx + cell) { sum += abs(a[y * cols + x] - b[y * cols + x]) } }
        cells.append(sum / Double(cell * cell))
      }
    }
    cells.sort()
    return cells[Int(Double(cells.count - 1) * percentile)]
  }

  var times: [Double] = [], sigs: [[Double]] = [], dPrev: [Double] = []
  var t = 0.0
  while t < video.duration {
    autoreleasepool {
      if let s = signature(at: t) {
        dPrev.append(sigs.last.map { diff($0, s) } ?? 0)
        times.append(t); sigs.append(s)
      }
    }
    if times.count % 60 == 0 {
      progress(String(format: "segments %@ / %@", formatTime(t), formatTime(video.duration)),
               phase: "segments", done: t, total: video.duration)
    }
    t += step
  }
  progressDone()
  guard !times.isEmpty else { die("no frames read") }

  var segments: [Segment] = []
  var segStart = 0            // index where the current fixed segment starts
  var ref = sigs[0]
  var burstStart: Int? = nil  // index where a run of large frame-to-frame changes began
  var calm = 0
  var driftRun = 0

  func closeFixed(at end: Int) {
    segments.append(Segment(index: 0, from: times[segStart], to: times[end], kind: "fixed", refTime: times[segStart], mat: nil))
  }

  var k = 1
  while k < times.count {
    let moving = dPrev[k] >= moveThreshold
    if moving {
      if burstStart == nil { burstStart = k - 1 }
      calm = 0
      driftRun = 0
    } else if let b = burstStart {
      calm += 1
      if calm >= settleSamples {
        let settledAt = k - settleSamples + 1
        if diff(ref, sigs[settledAt]) < sameThreshold {
          // Came back to the same view: someone walked past the lens.
        } else {
          if b > segStart { closeFixed(at: b) }
          segments.append(Segment(index: 0, from: times[b], to: times[settledAt], kind: "moving", refTime: times[b], mat: nil))
          segStart = settledAt
          ref = sigs[settledAt]
        }
        burstStart = nil
        calm = 0
      }
    } else {
      // Slow pan / bump with no big frame-to-frame jump.
      driftRun = diff(ref, sigs[k]) >= sameThreshold ? driftRun + 1 : 0
      if driftRun >= driftSamples {
        let at = k - driftSamples + 1
        closeFixed(at: at)
        segStart = at
        ref = sigs[at]
        driftRun = 0
      }
    }
    if args.switches.contains("debug") {
      print(String(format: "%@ dPrev=%.2f dRef=%.2f%@", formatTime(times[k]), dPrev[k], diff(ref, sigs[k]), moving ? " *" : ""))
    }
    k += 1
  }
  if let b = burstStart {
    if b > segStart { closeFixed(at: b) }
    segments.append(Segment(index: 0, from: times[b], to: video.duration, kind: "moving", refTime: times[b], mat: nil))
  } else {
    segments.append(Segment(index: 0, from: times[segStart], to: video.duration, kind: "fixed", refTime: times[segStart], mat: nil))
  }

  // Clean-up. Crowds right in front of the lens make the raw pass split one camera
  // position into many pieces, so:
  //  1. merge neighbouring fixed segments (with any short "moving" gap between them)
  //     when they show the same view;
  //  2. treat fixed stretches too short to be a real camera position as moving;
  //  3. merge neighbouring moving stretches.
  let minFixed = args.double("min-fixed", 15)
  let maxGap = args.double("max-gap", 5)
  func sig(near t: Double) -> [Double] {
    let i = times.indices.min { abs(times[$0] - t) < abs(times[$1] - t) }!
    return sigs[i]
  }
  // A segment's view = the signature in its calmest moment.
  func view(_ s: Segment) -> [Double] {
    let idx = times.indices.filter { times[$0] >= s.from && times[$0] <= s.to }
    guard let best = idx.dropFirst().min(by: { dPrev[$0] < dPrev[$1] }) ?? idx.first else { return sig(near: s.from) }
    return sigs[best]
  }
  var merged: [Segment] = []
  for s in segments {
    if s.kind == "fixed", let lastFixed = merged.lastIndex(where: { $0.kind == "fixed" }) {
      let gap = merged[(lastFixed + 1)...].reduce(0) { $0 + ($1.to - $1.from) }
      if gap <= maxGap && diff(view(merged[lastFixed]), view(s)) < sameThreshold {
        merged[lastFixed].to = s.to
        merged.removeSubrange((lastFixed + 1)...)
        continue
      }
    }
    merged.append(s)
  }
  // Someone standing right in front of the lens for a while (a marshal handing out medals)
  // changes almost every cell, like a move. But a camera that really moved doesn't come back
  // to the same view later: if a share of a still stretch shows the view of an earlier one,
  // the camera never moved in between — join them, "moves" included. (A share, not one
  // moment: in a long busy video two crowd frames can look alike by chance.) Kept strict on
  // purpose: joining a real move would put the wrong mat on a view; a false move only tags
  // the bibs there 004 Camera moving (they are still read).
  let sameShare = args.double("same-share", 0.10)
  // Judged on the typical cell (median), not the 10% most alike: sky and road alone must not
  // make two views "the same". Moments with someone at the lens simply don't match.
  let viewPercentile = args.double("view-percentile", 0.5)
  func samples(_ s: Segment, count n: Int = 24) -> [[Double]] {
    let idx = times.indices.filter { times[$0] >= s.from && times[$0] <= s.to }
    guard !idx.isEmpty else { return [sig(near: s.from)] }
    return stride(from: 0, to: idx.count, by: max(1, idx.count / n)).map { sigs[idx[$0]] }
  }
  func sameView(_ a: Segment, _ b: Segment) -> Bool {
    let sa = samples(a), sb = samples(b)
    func share(_ xs: [[Double]], seenIn ys: [[Double]]) -> Double {
      Double(xs.filter { x in ys.contains { diff(x, $0, percentile: viewPercentile) < sameThreshold } }.count) / Double(xs.count)
    }
    let shareA = share(sa, seenIn: sb), shareB = share(sb, seenIn: sa)
    if args.switches.contains("debug") {
      print(String(format: "sameView %@–%@ vs %@–%@: %.0f%% / %.0f%% of moments match", formatTime(a.from), formatTime(a.to),
                   formatTime(b.from), formatTime(b.to), shareA * 100, shareB * 100))
    }
    return min(shareA, shareB) >= sameShare
  }
  var i = 0
  while i < merged.count {
    if merged[i].kind == "fixed",
       let j = merged.indices.last(where: { $0 > i && merged[$0].kind == "fixed" && sameView(merged[i], merged[$0]) }) {
      merged[i].to = merged[j].to
      merged.removeSubrange((i + 1)...j)
    }
    i += 1
  }
  for i in merged.indices where merged[i].kind == "fixed" && merged[i].to - merged[i].from < minFixed {
    merged[i].kind = "moving"
  }
  segments = []
  for s in merged {
    if s.kind == "moving", var last = segments.last, last.kind == "moving" {
      last.to = s.to
      segments[segments.count - 1] = last
    } else {
      segments.append(s)
    }
  }

  // Number the segments; pick the calmest sample of each fixed segment as its reference frame.
  for i in segments.indices {
    segments[i].index = i + 1
    guard segments[i].kind == "fixed" else { continue }
    let idx = times.indices.filter { times[$0] >= segments[i].from && times[$0] <= segments[i].to }
    if let best = idx.dropFirst().min(by: { dPrev[$0] < dPrev[$1] }) { segments[i].refTime = times[best] }
  }

  writeJSON(SegmentsFile(video: video.url.lastPathComponent, duration: video.duration, segments: segments), outPath)
  print("\(segments.count) segment(s) in \(Int(Date().timeIntervalSince(started)))s:")
  for s in segments {
    print("  #\(s.index) \(s.kind.padding(toLength: 6, withPad: " ", startingAt: 0)) \(formatTime(s.from))–\(formatTime(s.to))" + (s.kind == "fixed" ? "  (mark mat at \(formatTime(s.refTime)))" : ""))
  }
  print("written: \(outPath) — open it in the viewer to mark the mat for each fixed segment")
}
