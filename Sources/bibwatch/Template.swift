import AppKit
import CoreGraphics
import Foundation
import Vision

/// A bib design, measured — not trained. From the bib artwork it takes the band colour, the
/// digit colour and how big the digits are relative to the band; calibrating on real footage
/// (a few clear bibs) replaces the printed colours with how they actually look on camera and
/// adds the range of digit sizes to look for.
struct BibTemplate: Codable {
  var name: String
  /// Band colour as hue (degrees) ± tolerance, with minimum saturation / brightness.
  var bandHue: Double
  var hueTolerance: Double
  var bandSatMin: Double
  var bandValMin: Double
  /// Digit colour (white-ish): max saturation, min brightness.
  var digitSatMax: Double
  var digitValMin: Double
  /// Digit height as a fraction of the frame height (from calibration; wide defaults before).
  var digitHeightMin: Double
  var digitHeightMax: Double
  var digits: Int
  var maxBib: Int
  /// Lowest bib number for this design (e.g. another category's bibs may start at 0251).
  var minBib: Int? = nil
  var calibrated: Int
  var samples: [TemplateSample]?
}

struct TemplateSample: Codable {
  var video: String
  var t: Double
  var x: Double
  var y: Double
  var hue: Double
  var sat: Double
  var val: Double
  var digitHeight: Double
  var digitSat: Double? = nil
  var digitVal: Double? = nil
}

// MARK: - Pixel masks

/// Band-coloured / digit-coloured test on raw RGBA bytes (fast path, no HSV struct).
struct ColorRule {
  let hue: Double, tol: Double, satMin: Double, valMin: Double, digitSatMax: Double, digitValMin: Double

  init(_ t: BibTemplate, widen: Double = 0) {
    hue = t.bandHue; tol = t.hueTolerance + widen
    satMin = max(0.15, t.bandSatMin - widen / 200); valMin = max(0.12, t.bandValMin - widen / 200)
    digitSatMax = t.digitSatMax; digitValMin = t.digitValMin
  }

  @inline(__always) static func hsv(_ r: UInt8, _ g: UInt8, _ b: UInt8) -> (Double, Double, Double) {
    let rf = Double(r) / 255, gf = Double(g) / 255, bf = Double(b) / 255
    let mx = max(rf, gf, bf), mn = min(rf, gf, bf), d = mx - mn
    var h = 0.0
    if d > 0 {
      if mx == rf { h = 60 * ((gf - bf) / d).truncatingRemainder(dividingBy: 6) }
      else if mx == gf { h = 60 * ((bf - rf) / d + 2) }
      else { h = 60 * ((rf - gf) / d + 4) }
    }
    if h < 0 { h += 360 }
    return (h, mx == 0 ? 0 : d / mx, mx)
  }

  @inline(__always) func isBand(_ h: Double, _ s: Double, _ v: Double) -> Bool {
    var dh = abs(h - hue); if dh > 180 { dh = 360 - dh }
    return dh <= tol && s >= satMin && v >= valMin
  }
  @inline(__always) func isDigit(_ s: Double, _ v: Double) -> Bool { s <= digitSatMax && v >= digitValMin }
}

// MARK: - Finder: band-coloured surroundings → white digit shapes → rows of digits

struct BibCandidate {
  var box: Box            // number area, frame fractions
  var digitHeight: Double // fraction of frame height
  var members: Int
  var template: Int = 0   // index into the templates in use
}

/// Candidates from every template; where two designs claim the same area, the first wins.
func findAllCandidates(_ px: Pixels, _ templates: [BibTemplate]) -> [(BibCandidate, BibTemplate)] {
  var out: [(BibCandidate, BibTemplate)] = []
  for (i, tpl) in templates.enumerated() {
    for var c in findBibCandidates(px, tpl) {
      c.template = i
      let overlaps = out.contains { o in
        let ix = max(0, min(o.0.box.x1, c.box.x1) - max(o.0.box.x0, c.box.x0))
        let iy = max(0, min(o.0.box.y1, c.box.y1) - max(o.0.box.y0, c.box.y0))
        return ix * iy > 0.5 * min(o.0.box.area, c.box.area)
      }
      if !overlaps { out.append((c, tpl)) }
    }
  }
  return out
}

/// Finds number areas: white blobs of digit size and shape, sitting on the band colour, in a
/// row of 2–6 similar blobs. Works even when the band touches a same-coloured shirt, because
/// it looks for the white digits *on* the colour rather than for the band's outline.
func findBibCandidates(_ px: Pixels, _ tpl: BibTemplate, widen: Double = 0) -> [BibCandidate] {
  let rule = ColorRule(tpl, widen: widen)
  let W = px.width, H = px.height
  let minH = max(5, Int(tpl.digitHeightMin * Double(H))), maxH = max(minH + 2, Int(tpl.digitHeightMax * Double(H)))

  // Digit-coloured mask.
  var white = [Bool](repeating: false, count: W * H)
  px.data.withUnsafeBufferPointer { d in
    for i in 0..<(W * H) {
      let o = i * 4
      let r = d[o], g = d[o + 1], b = d[o + 2]
      let mx = max(r, g, b), mn = min(r, g, b)
      let v = Double(mx) / 255
      let s = mx == 0 ? 0 : Double(mx - mn) / Double(mx)
      white[i] = rule.isDigit(s, v)
    }
  }
  func bandAt(_ x: Int, _ y: Int) -> Bool {
    guard x >= 0, y >= 0, x < W, y < H else { return false }
    let o = (y * W + x) * 4
    let (h, s, v) = ColorRule.hsv(px.data[o], px.data[o + 1], px.data[o + 2])
    return rule.isBand(h, s, v)
  }

  // Connected white blobs (4-neighbour), keeping digit-sized ones.
  struct Blob { var x0: Int, y0: Int, x1: Int, y1: Int, n: Int
    var h: Int { y1 - y0 + 1 }; var w: Int { x1 - x0 + 1 }
    var cy: Double { Double(y0 + y1) / 2 } }
  var label = [Int32](repeating: 0, count: W * H)
  var blobs: [Blob] = []
  var stack: [Int] = []
  var next: Int32 = 1
  for start in 0..<(W * H) where white[start] && label[start] == 0 {
    var b = Blob(x0: W, y0: H, x1: 0, y1: 0, n: 0)
    stack.append(start); label[start] = next
    var tooBig = false
    while let i = stack.popLast() {
      let x = i % W, y = i / W
      b.n += 1
      b.x0 = min(b.x0, x); b.x1 = max(b.x1, x); b.y0 = min(b.y0, y); b.y1 = max(b.y1, y)
      if b.y1 - b.y0 > maxH * 2 || b.x1 - b.x0 > maxH * 2 { tooBig = true }
      for j in [i - 1, i + 1, i - W, i + W] where j >= 0 && j < W * H && white[j] && label[j] == 0 {
        if (j == i - 1 && x == 0) || (j == i + 1 && x == W - 1) { continue }
        label[j] = next; stack.append(j)
      }
    }
    next += 1
    if tooBig { continue }
    let aspect = Double(b.w) / Double(b.h)
    let fill = Double(b.n) / Double(b.w * b.h)
    guard b.h >= minH, b.h <= maxH, aspect >= 0.12, aspect <= 1.1, fill >= 0.15, fill <= 0.9 else { continue }
    // The blob must sit on band colour: sample a ring around it.
    let pad = max(2, b.h / 4)
    var ring = 0, band = 0
    let stepR = max(1, b.h / 8)
    for x in stride(from: b.x0 - pad, through: b.x1 + pad, by: stepR) {
      for y in [b.y0 - pad, b.y1 + pad] { ring += 1; if bandAt(x, y) { band += 1 } }
    }
    for y in stride(from: b.y0 - pad, through: b.y1 + pad, by: stepR) {
      for x in [b.x0 - pad, b.x1 + pad] { ring += 1; if bandAt(x, y) { band += 1 } }
    }
    if ring > 0 && Double(band) / Double(ring) >= 0.40 { blobs.append(b) }
  }

  // Rows of similar blobs = a number.
  blobs.sort { $0.x0 < $1.x0 }
  var used = [Bool](repeating: false, count: blobs.count)
  var out: [BibCandidate] = []
  for i in blobs.indices where !used[i] {
    var group = [i]
    var last = blobs[i]
    for j in (i + 1)..<blobs.count where !used[j] {
      let b = blobs[j]
      let ratio = Double(b.h) / Double(last.h)
      let gap = b.x0 - last.x1
      if abs(b.cy - last.cy) <= Double(last.h) * 0.35, ratio >= 0.7, ratio <= 1.43, gap >= -2, Double(gap) <= Double(last.h) * 0.9 {
        group.append(j); last = b
      }
      if b.x0 > last.x1 + last.h * 2 { break }
    }
    guard group.count >= 2, group.count <= tpl.digits + 2 else { continue }
    group.forEach { used[$0] = true }
    let gb = group.map { blobs[$0] }
    let x0 = gb.map(\.x0).min()!, x1 = gb.map(\.x1).max()!, y0 = gb.map(\.y0).min()!, y1 = gb.map(\.y1).max()!
    let h = Double(y1 - y0 + 1)
    // Generous margins: a digit that failed the blob test (thin "1", "7" touching the edge)
    // must still be inside the crop, or it gets read as something else.
    let bx0 = (Double(x0) - 0.9 * h) / Double(W), bx1 = (Double(x1) + 0.9 * h) / Double(W)
    let by0 = (Double(y0) - 0.35 * h) / Double(H), by1 = (Double(y1) + 0.35 * h) / Double(H)
    out.append(BibCandidate(box: Box(x0: max(0, bx0), y0: max(0, by0), x1: min(1, bx1), y1: min(1, by1)),
                            digitHeight: h / Double(H), members: group.count))
  }
  return out
}

/// Reads the numbers in the candidate areas with one text-recognition call: the crops are
/// enlarged and stacked into a single strip, so small / far bibs become readable.
func readCandidates(_ image: CGImage, _ cands: [(BibCandidate, BibTemplate)]) -> [BibRead] {
  guard !cands.isEmpty else { return [] }
  let rowH = 96.0, gap = 24.0
  var rows: [(cand: BibCandidate, tpl: BibTemplate, rect: CGRect, y: Double, w: Double)] = []
  var y = gap, width = 0.0
  for (c, tpl) in cands {
    let r = CGRect(x: c.box.x0 * Double(image.width), y: c.box.y0 * Double(image.height),
                   width: (c.box.x1 - c.box.x0) * Double(image.width), height: (c.box.y1 - c.box.y0) * Double(image.height)).integral
    guard r.width > 2, r.height > 2 else { continue }
    let scale = rowH / r.height
    let w = r.width * scale
    rows.append((c, tpl, r, y, w))
    y += rowH + gap
    width = max(width, w)
  }
  guard !rows.isEmpty else { return [] }
  let W = Int(width + 2 * gap), H = Int(y)
  guard let ctx = CGContext(data: nil, width: W, height: H, bitsPerComponent: 8, bytesPerRow: 0,
                            space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return [] }
  ctx.setFillColor(CGColor(gray: 0, alpha: 1))
  ctx.fill(CGRect(x: 0, y: 0, width: W, height: H))
  ctx.interpolationQuality = .high
  for row in rows {
    guard let crop = image.cropping(to: row.rect) else { continue }
    // CoreGraphics origin is bottom-left.
    ctx.draw(crop, in: CGRect(x: gap, y: Double(H) - row.y - rowH, width: row.w, height: rowH))
  }
  guard let mosaic = ctx.makeImage() else { return [] }
  let req = VNRecognizeTextRequest()
  req.recognitionLevel = .accurate
  req.usesLanguageCorrection = false
  req.minimumTextHeight = Float(rowH * 0.4 / Double(H))
  try? VNImageRequestHandler(cgImage: mosaic, options: [:]).perform([req])

  var reads: [BibRead] = []
  for obs in req.results ?? [] {
    // Which row is this text in? (Vision boxes are normalised, bottom-left origin.)
    let midY = (1 - obs.boundingBox.midY) * Double(H)
    guard let row = rows.first(where: { midY >= $0.y - gap / 2 && midY <= $0.y + rowH + gap / 2 }) else { continue }
    for cand in obs.topCandidates(2) {
      let lo = row.tpl.minBib ?? 1
      let nums = BibText.numbers(cand.string, maxBib: row.tpl.maxBib).filter { (Int($0.bib) ?? 0) >= lo }
      if let n = nums.first(where: { !$0.fragment }) ?? nums.first {
        reads.append(BibRead(bib: n.bib, box: row.cand.box, confidence: Double(cand.confidence), template: row.tpl.name,
                             fragment: n.fragment ? true : nil))
        break
      }
    }
  }
  // One number per area.
  var best: [String: BibRead] = [:]
  for r in reads {
    let k = "\(Int(r.box.x0 * 1000)),\(Int(r.box.y0 * 1000))"
    if best[k] == nil || best[k]!.confidence < r.confidence { best[k] = r }
  }
  return Array(best.values)
}

// MARK: - Commands

/// bibwatch template <design image> <template.json> [--name N] [--digits 4] [--max-bib 250]
func runTemplate(_ raw: [String]) {
  let (points, restArgs) = takePoints(raw)
  let args = Args(restArgs, switches: [])
  applyBibOptions(args)
  // From a bib in the footage instead of artwork: bibwatch template --from-video V --at t,x,y out.json
  if let videoPath = args.options["from-video"] {
    guard let out = args.positional.first, !points.isEmpty else { die("usage: bibwatch template --from-video <video> --at t,x,y [--at …] <template.json> [--name N] [--min-bib 1] [--max-bib 250]") }
    let base = BibTemplate(name: args.options["name"] ?? URL(fileURLWithPath: out).deletingPathExtension().lastPathComponent,
                           bandHue: 0, hueTolerance: 180, bandSatMin: 0.25, bandValMin: 0.2, digitSatMax: 0.40, digitValMin: 0.45,
                           digitHeightMin: 0.004, digitHeightMax: 0.12, digits: Int(args.double("digits", 4)),
                           maxBib: Int(args.double("max-bib", 250)), minBib: args.options["min-bib"].flatMap(Int.init), calibrated: 0, samples: [])
    writeJSON(calibrateTemplate(base, video: VideoSource(path: videoPath), points: points, anyColour: true), out)
    print("written: \(out)")
    return
  }
  guard args.positional.count >= 2 else { die("usage: bibwatch template <bib design image> <template.json> [--name N] [--digits 4] [--min-bib 1] [--max-bib 250]") }
  guard let img = NSImage(contentsOfFile: args.positional[0]),
        let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil),
        let px = Pixels(cg) else { die("cannot read image \(args.positional[0])") }

  // Dominant saturated colour = the band.
  var bins = [Int](repeating: 0, count: 36)
  var sats: [Double] = [], vals: [Double] = [], hues: [Double] = []
  for y in stride(from: 0, to: px.height, by: 2) {
    for x in stride(from: 0, to: px.width, by: 2) {
      let o = (y * px.width + x) * 4
      let (h, s, v) = ColorRule.hsv(px.data[o], px.data[o + 1], px.data[o + 2])
      if s >= 0.45 && v >= 0.35 { bins[min(35, Int(h / 10))] += 1; hues.append(h); sats.append(s); vals.append(v) }
    }
  }
  guard let peak = bins.indices.max(by: { bins[$0] < bins[$1] }), bins[peak] > 0 else { die("no strong colour found in the design") }
  let peakHue = Double(peak) * 10 + 5
  let inBand = hues.indices.filter { var d = abs(hues[$0] - peakHue); if d > 180 { d = 360 - d }; return d <= 25 }
  // Circular mean of the band hues.
  let sx = inBand.reduce(0.0) { $0 + cos(hues[$1] * .pi / 180) }, sy = inBand.reduce(0.0) { $0 + sin(hues[$1] * .pi / 180) }
  var hue = atan2(sy, sx) * 180 / .pi; if hue < 0 { hue += 360 }
  let bs = inBand.map { sats[$0] }.sorted(), bv = inBand.map { vals[$0] }.sorted()
  let p10 = { (a: [Double]) in a[max(0, Int(Double(a.count) * 0.1))] }

  let tpl = BibTemplate(
    name: args.options["name"] ?? URL(fileURLWithPath: args.positional[1]).deletingPathExtension().lastPathComponent,
    bandHue: (hue * 10).rounded() / 10, hueTolerance: 22,
    // Printed colours look duller and darker on camera — start generous; calibration tightens.
    bandSatMin: (p10(bs) * 0.55 * 100).rounded() / 100, bandValMin: (p10(bv) * 0.45 * 100).rounded() / 100,
    // Printed white digits look slightly grey/tinted on camera, especially in shade.
    digitSatMax: 0.40, digitValMin: 0.45,
    digitHeightMin: 0.006, digitHeightMax: 0.08,
    digits: Int(args.double("digits", 4)), maxBib: Int(args.double("max-bib", 250)),
    minBib: args.options["min-bib"].flatMap(Int.init), calibrated: 0, samples: [])
  writeJSON(tpl, args.positional[1])
  print(String(format: "band colour: hue %.0f° ±%.0f, saturation ≥ %.2f, brightness ≥ %.2f · digits: white, %d per number",
               tpl.bandHue, tpl.hueTolerance, tpl.bandSatMin, tpl.bandValMin, tpl.digits))
  print("written: \(args.positional[1]) — calibrate it on a few clear bibs in the video next")
}

/// bibwatch calibrate <template.json> <video> --at t,x,y [--at t,x,y …]
/// x, y = a point on the bib number (frame fractions). Measures the band colour and digit
/// size as they look on camera and updates the template.
func runCalibrate(_ raw: [String]) {
  let (points, rest) = takePoints(raw)
  let args = Args(rest, switches: [])
  applyBibOptions(args)
  guard args.positional.count >= 2, !points.isEmpty else { die("usage: bibwatch calibrate <template.json> <video> --at t,x,y [--at t,x,y …]") }
  let tpl = calibrateTemplate(readJSON(BibTemplate.self, args.positional[0]), video: VideoSource(path: args.positional[1]), points: points)
  writeJSON(tpl, args.positional[0])
}

/// Split "--at t,x,y" pairs out of an argument list.
func takePoints(_ raw: [String]) -> ([(Double, Double, Double)], [String]) {
  var points: [(Double, Double, Double)] = [], rest: [String] = []
  var i = 0
  while i < raw.count {
    if raw[i] == "--at", i + 1 < raw.count {
      let p = raw[i + 1].split(separator: ",").compactMap { Double($0) }
      if p.count == 3 { points.append((p[0], p[1], p[2])) }
      i += 2
    } else { rest.append(raw[i]); i += 1 }
  }
  return (points, rest)
}

/// Measure the band colour and digit size of the bibs at the given points and fold them into
/// the template. With `anyColour`, the band colour is not known yet (template made from video).
func calibrateTemplate(_ start: BibTemplate, video: VideoSource, points: [(Double, Double, Double)], anyColour: Bool = false) -> BibTemplate {
  var tpl = start
  var samples = tpl.samples ?? []
  var found = 0

  for (t, x, y) in points {
    guard let img = video.frame(at: t), let px = Pixels(img) else { continue }
    // Look near the click with a wide colour range and any digit size.
    var loose = tpl
    loose.hueTolerance = anyColour ? 180 : max(tpl.hueTolerance, 35); loose.bandSatMin = 0.2; loose.bandValMin = 0.15
    loose.digitHeightMin = 0.004; loose.digitHeightMax = 0.12
    loose.digitSatMax = 0.5; loose.digitValMin = 0.35
    let near = findBibCandidates(px, loose).filter { c in
      let dx = max(c.box.x0 - x, 0, x - c.box.x1), dy = max(c.box.y0 - y, 0, y - c.box.y1)
      return dx < 0.03 && dy < 0.03
    }.min { abs($0.box.cx - x) + abs($0.box.cy - y) < abs($1.box.cx - x) + abs($1.box.cy - y) }
    guard let c = near else {
      print(String(format: "  %@ (%.2f, %.2f): no bib number found there", formatTime(t, tenths: true), x, y)); continue
    }
    // Band colour just outside the digits' area.
    var hs: [Double] = [], ss: [Double] = [], vs: [Double] = []
    let pad = 0.4 * (c.box.y1 - c.box.y0)
    for k in 0..<60 {
      let fx = c.box.x0 + (c.box.x1 - c.box.x0) * (Double(k % 20) + 0.5) / 20
      let fy = k < 20 ? c.box.y0 - pad * 0.3 : k < 40 ? c.box.y1 + pad * 0.3 : c.box.cy
      let sampleX = k < 40 ? fx : (k % 2 == 0 ? c.box.x0 - pad * 0.3 : c.box.x1 + pad * 0.3)
      if let p = px.hsv(sampleX, fy), p.s > 0.2 { hs.append(p.h); ss.append(p.s); vs.append(p.v) }
    }
    guard hs.count >= 8 else { print("  no band colour around that number"); continue }
    // Digit colour: the brightest, least saturated pixels inside the number area.
    var inner: [(s: Double, v: Double)] = []
    for iy in 0..<12 { for ix in 0..<24 {
      let fx = c.box.x0 + (c.box.x1 - c.box.x0) * (Double(ix) + 0.5) / 24
      let fy = c.box.y0 + (c.box.y1 - c.box.y0) * (Double(iy) + 0.5) / 12
      if let p = px.hsv(fx, fy) { inner.append((p.s, p.v)) }
    } }
    let brightest = inner.sorted { $0.v - $0.s > $1.v - $1.s }.prefix(max(4, inner.count / 5))
    let digitSat = brightest.map(\.s).max() ?? 0.3, digitVal = brightest.map(\.v).min() ?? 0.55
    let sx = hs.reduce(0.0) { $0 + cos($1 * .pi / 180) }, sy = hs.reduce(0.0) { $0 + sin($1 * .pi / 180) }
    var h = atan2(sy, sx) * 180 / .pi; if h < 0 { h += 360 }
    ss.sort(); vs.sort()
    samples.removeAll { $0.video == video.url.lastPathComponent && abs($0.t - t) < 0.01 && abs($0.x - x) < 0.01 && abs($0.y - y) < 0.01 }
    samples.append(TemplateSample(video: video.url.lastPathComponent, t: t, x: x, y: y, hue: (h * 10).rounded() / 10,
                                  sat: ss[ss.count / 5], val: vs[vs.count / 5], digitHeight: c.digitHeight,
                                  digitSat: (digitSat * 100).rounded() / 100, digitVal: (digitVal * 100).rounded() / 100))
    found += 1
    print(String(format: "  %@: number found, band hue %.0f°, digits %.1f%% of frame height", formatTime(t, tenths: true), h, c.digitHeight * 100))
  }
  guard !samples.isEmpty else { die("no calibration sample worked — click right on the numbers of clear, front-facing bibs") }

  // Band colour from the samples (circular mean ± spread), sizes from the smallest/largest seen.
  let sx = samples.reduce(0.0) { $0 + cos($1.hue * .pi / 180) }, sy = samples.reduce(0.0) { $0 + sin($1.hue * .pi / 180) }
  var hue = atan2(sy, sx) * 180 / .pi; if hue < 0 { hue += 360 }
  let spread = samples.map { s -> Double in var d = abs(s.hue - hue); if d > 180 { d = 360 - d }; return d }.max() ?? 0
  tpl.bandHue = (hue * 10).rounded() / 10
  tpl.hueTolerance = max(15, (spread + 10).rounded())
  // Leave room for light and shade the samples didn't cover: bands in shadow get duller and
  // darker. The hue range stays tight — that's what separates one design from another.
  func r2(_ v: Double) -> Double { (v * 100).rounded() / 100 }
  tpl.bandSatMin = r2(min(max((samples.map(\.sat).min() ?? 0.4) * 0.5, 0.2), 0.45))
  tpl.bandValMin = r2(min(max((samples.map(\.val).min() ?? 0.3) * 0.5, 0.12), 0.35))
  // Digit colour from the samples, with room for shade (never stricter than the defaults).
  let dSat = samples.compactMap(\.digitSat), dVal = samples.compactMap(\.digitVal)
  tpl.digitSatMax = r2(min(0.5, max(0.40, (dSat.max() ?? 0.3) + 0.1)))
  tpl.digitValMin = r2(max(0.35, min(0.45, (dVal.min() ?? 0.55) - 0.1)))
  tpl.digitHeightMin = max(0.004, (samples.map(\.digitHeight).min() ?? 0.01) * 0.45)
  tpl.digitHeightMax = min(0.15, (samples.map(\.digitHeight).max() ?? 0.04) * 2.0)
  tpl.calibrated = samples.count
  tpl.samples = samples
  print(String(format: "calibrated on %d bib(s): band hue %.0f° ±%.0f, saturation ≥ %.2f, brightness ≥ %.2f, digits %.1f–%.1f%% of frame height",
               samples.count, tpl.bandHue, tpl.hueTolerance, tpl.bandSatMin, tpl.bandValMin, tpl.digitHeightMin * 100, tpl.digitHeightMax * 100))
  return tpl
}

/// bibwatch finder <video> --template T --at t   → JSON: candidate areas + numbers read (for the viewer overlay).
func runFinder(_ raw: [String]) {
  let args = Args(raw, switches: [])
  applyBibOptions(args)
  guard args.positional.count >= 1, let tplPaths = args.all["template"], let at = args.options["at"] else {
    die("usage: bibwatch finder <video> --template template.json [--template another.json …] --at seconds")
  }
  let templates = tplPaths.map { readJSON(BibTemplate.self, $0) }
  let video = VideoSource(path: args.positional[0])
  let t = parseTime(at)
  guard let img = video.frame(at: t), let px = Pixels(img) else { die("cannot read frame") }
  let started = Date()
  let cands = findAllCandidates(px, templates)
  let findMs = Int(Date().timeIntervalSince(started) * 1000)
  let reads = readCandidates(img, cands)
  let ms = Int(Date().timeIntervalSince(started) * 1000)
  let out: [String: Any] = [
    "t": t, "ms": ms, "findMs": findMs,
    "candidates": cands.map { c in ["template": c.1.name, "box": [c.0.box.x0, c.0.box.y0, c.0.box.x1, c.0.box.y1].map { ($0 * 10000).rounded() / 10000 }] as [String: Any] },
    "reads": reads.map { ["bib": $0.bib, "confidence": $0.confidence, "template": $0.template ?? "",
                          "box": [$0.box.x0, $0.box.y0, $0.box.x1, $0.box.y1].map { ($0 * 10000).rounded() / 10000 }] as [String: Any] },
  ]
  let data = try! JSONSerialization.data(withJSONObject: out)
  print(String(data: data, encoding: .utf8)!)
}
