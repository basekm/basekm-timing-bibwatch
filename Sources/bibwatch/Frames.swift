import AVFoundation
import CoreGraphics
import Vision

/// Grabs frames from a video file. Frames stay in memory only; nothing is written to disk.
final class VideoSource {
  let url: URL
  let duration: Double
  private let generator: AVAssetImageGenerator

  init(path: String, maxWidth: CGFloat? = nil) {
    url = URL(fileURLWithPath: path)
    let asset = AVURLAsset(url: url)
    duration = CMTimeGetSeconds(asset.duration)
    guard duration > 0 else { die("cannot read video \(path)") }
    generator = AVAssetImageGenerator(asset: asset)
    generator.appliesPreferredTrackTransform = true
    generator.requestedTimeToleranceBefore = CMTime(seconds: 0.04, preferredTimescale: 600)
    generator.requestedTimeToleranceAfter = CMTime(seconds: 0.04, preferredTimescale: 600)
    if let w = maxWidth { generator.maximumSize = CGSize(width: w, height: w) }
  }

  func frame(at t: Double) -> CGImage? {
    timed("decode") { try? generator.copyCGImage(at: CMTime(seconds: t, preferredTimescale: 600), actualTime: nil) }
  }
}

/// Raw RGBA pixels of a frame, for colour checks and thumbnails.
struct Pixels {
  let width: Int, height: Int, data: [UInt8]

  init?(_ image: CGImage) {
    width = image.width; height = image.height
    var buffer = [UInt8](repeating: 0, count: width * height * 4)
    guard let ctx = CGContext(data: &buffer, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4,
                              space: CGColorSpaceCreateDeviceRGB(),
                              bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return nil }
    ctx.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
    data = buffer
  }

  func rgb(_ x: Double, _ y: Double) -> (Double, Double, Double)? {
    let px = Int(x * Double(width)), py = Int(y * Double(height))
    guard px >= 0, py >= 0, px < width, py < height else { return nil }
    let o = (py * width + px) * 4
    return (Double(data[o]) / 255, Double(data[o + 1]) / 255, Double(data[o + 2]) / 255)
  }

  func hsv(_ x: Double, _ y: Double) -> (h: Double, s: Double, v: Double)? {
    guard let (r, g, b) = rgb(x, y) else { return nil }
    let mx = max(r, g, b), mn = min(r, g, b), d = mx - mn
    var hue = 0.0
    if d > 0 {
      if mx == r { hue = 60 * ((g - b) / d).truncatingRemainder(dividingBy: 6) }
      else if mx == g { hue = 60 * ((b - r) / d + 2) }
      else { hue = 60 * ((r - g) / d + 4) }
    }
    if hue < 0 { hue += 360 }
    return (hue, mx == 0 ? 0 : d / mx, mx)
  }

  /// Luma values of a region (fractions), resampled to cols×rows.
  func luma(cols: Int, rows: Int, top: Double, bottom: Double) -> [Double] {
    var out: [Double] = []
    out.reserveCapacity(cols * rows)
    for j in 0..<rows {
      for i in 0..<cols {
        let x = (Double(i) + 0.5) / Double(cols)
        let y = top + (bottom - top) * (Double(j) + 0.5) / Double(rows)
        if let (r, g, b) = rgb(x, y) { out.append(0.299 * r + 0.587 * g + 0.114 * b) } else { out.append(0) }
      }
    }
    return out
  }
}

// MARK: - Bib reading

/// Run Fur Fun bib design: big white digits on a solid magenta band, "5KM" beside them,
/// logos and "2026" on white above. A read counts only if the text is mostly white and
/// sits on magenta — drops shirt logos, the "2026" in the bib logo, signage, teal bibs.
enum BibColor {
  static func isMagenta(_ p: (h: Double, s: Double, v: Double)) -> Bool { (p.h >= 300 || p.h <= 15) && p.s >= 0.35 && p.v >= 0.25 }
  static func isWhite(_ p: (h: Double, s: Double, v: Double)) -> Bool { p.s <= 0.28 && p.v >= 0.55 }

  static func looksLikeBib(_ px: Pixels, _ b: Box) -> Bool {
    let bw = b.x1 - b.x0, bh = b.y1 - b.y0
    var white = 0, inside = 0, magentaInside = 0
    for i in 0..<12 {
      for j in 0..<8 {
        let x = b.x0 + bw * (Double(i) + 0.5) / 12, y = b.y0 + bh * (Double(j) + 0.5) / 8
        if let p = px.hsv(x, y) { inside += 1; if isWhite(p) { white += 1 }; if isMagenta(p) { magentaInside += 1 } }
      }
    }
    let ex0 = b.x0 - bw * 0.25, ex1 = b.x1 + bw * 0.25, ey0 = b.y0 - bh * 0.35, ey1 = b.y1 + bh * 0.35
    var ring = 0, magentaRing = 0
    for i in 0..<16 {
      for j in 0..<12 {
        let x = ex0 + (ex1 - ex0) * (Double(i) + 0.5) / 16, y = ey0 + (ey1 - ey0) * (Double(j) + 0.5) / 12
        if b.contains(x, y) { continue }
        if let p = px.hsv(x, y) { ring += 1; if isMagenta(p) { magentaRing += 1 } }
      }
    }
    guard inside > 0, ring > 0 else { return false }
    let whiteFrac = Double(white) / Double(inside)
    let bandFrac = Double(magentaRing + magentaInside) / Double(ring + inside)
    return whiteFrac >= 0.12 && bandFrac >= 0.30
  }
}

/// Bib numbers: how many digits (per event; races can mix lengths, e.g. 4-digit 5K and
/// 6-digit marathon bibs) and the number range. A run one digit shorter than the fewest is kept
/// as a fragment (a digit hidden behind someone, or dropped by the reader).
/// The classic setting, 4 digits, pads fragments to 4 ("014" → "0014") as earlier scans did.
enum BibText {
  static let letterFix: [Character: Character] = ["O": "0", "o": "0", "D": "0", "Q": "0", "I": "1", "l": "1", "|": "1", "S": "5", "B": "8", "Z": "2"]

  /// Set once per command from --digits MIN-MAX and --min-bib (see `applyBibOptions`).
  static var minDigits = 4, maxDigits = 4, minBib = 1
  static var isClassic: Bool { minDigits == 4 && maxDigits == 4 }

  static func candidates(_ text: String, maxBib: Int) -> [String] { numbers(text, maxBib: maxBib).map(\.bib) }

  /// Numbers in the text, with whether each was only a fragment. Letters that look like digits
  /// count as digits ("5O19"), but not in a word ("CHUBB" is not 188) and not when they make up
  /// half the number or more ("IBB").
  static func numbers(_ text: String, maxBib: Int) -> [(bib: String, fragment: Bool)] {
    let lo = min(minBib, maxBib)
    var out: [(String, Bool)] = [], run = "", fixedLetters = 0, afterWord = false
    for ch in text + " " {
      if ch.isNumber { run.append(ch); continue }
      if let d = letterFix[ch] { run.append(d); fixedLetters += 1; continue }
      defer { run = ""; fixedLetters = 0; afterWord = ch.isLetter }
      let inWord = afterWord || ch.isLetter
      if fixedLetters > 0, inWord || fixedLetters * 2 >= run.count { continue }
      if let n = Int(run) {
        if (minDigits...maxDigits).contains(run.count), (lo...maxBib).contains(n) {
          out.append((run, false))
        } else if run.count == minDigits - 1, run.count > 0, (1...maxBib).contains(n) {
          out.append((isClassic ? String(format: "%04d", n) : run, true))
        }
      }
    }
    return out
  }
}

/// --digits MIN-MAX (e.g. 4-6) and --min-bib N, for every command that reads numbers.
func applyBibOptions(_ args: Args) {
  if let d = args.options["digits"] {
    let parts = d.split(separator: "-").compactMap { Int($0) }
    guard let a = parts.first, let b = parts.last, (1...9).contains(a), (a...9).contains(b) else {
      die("--digits needs MIN-MAX between 1 and 9, e.g. 4-6")
    }
    (BibText.minDigits, BibText.maxDigits) = (a, b)
  }
  if let m = args.options["min-bib"].flatMap(Int.init) { BibText.minBib = max(1, m) }
}

struct BibRead: Codable {
  var bib: String
  var box: Box
  var confidence: Double
  /// Read from only 3 digits (padded) — a partial number, e.g. "010" from a half-read "0109".
  var fragment: Bool? = nil
}

struct FrameReads {
  var bibs: [BibRead]
  var people: [Box]
  var rejectedByColor: Int
}

func readFrame(_ image: CGImage, people wantPeople: Bool, colorCheck: Bool, maxBib: Int, peopleFirst: Bool = false) -> FrameReads {
  if peopleFirst {
    return readPeopleFirst(image, people: wantPeople, maxBib: maxBib)
  }
  let text = VNRecognizeTextRequest()
  text.recognitionLevel = .accurate
  text.usesLanguageCorrection = false
  text.minimumTextHeight = 0.015
  let humans = VNDetectHumanRectanglesRequest()
  humans.upperBodyOnly = false
  timed("text") { try? VNImageRequestHandler(cgImage: image, options: [:]).perform(wantPeople ? [text, humans] : [text]) }

  var bibs: [BibRead] = []
  var rejected = 0
  var pixels: Pixels? = nil
  for obs in text.results ?? [] {
    var seen = Set<String>()
    for cand in obs.topCandidates(3) {
      for (bib, fragment) in BibText.numbers(cand.string, maxBib: maxBib) where !seen.contains(bib) {
        seen.insert(bib)
        let box = Box(visionRect: obs.boundingBox)
        if colorCheck {
          if pixels == nil { pixels = Pixels(image) }
          if let px = pixels, !BibColor.looksLikeBib(px, box) { rejected += 1; continue }
        }
        bibs.append(BibRead(bib: bib, box: box, confidence: Double(cand.confidence), fragment: fragment ? true : nil))
      }
    }
  }
  let people = wantPeople ? (humans.results ?? []).map { Box(visionRect: $0.boundingBox) } : []
  return FrameReads(bibs: bibs, people: people, rejectedByColor: rejected)
}

// MARK: - Person-first reading

/// Where a bib is pinned, as a part of a person's box: the torso — chest to belly, the body's
/// width plus a little either side (bibs sit off-centre, arms swing over them).
// Tuned on two hand-checked Chubb stretches (GX021737 2:30–3:00, Chubb - Trimmed.mp4): 29/29 bibs.
/// Part of a person's height searched for a bib: 10–90 % catches bibs pinned low and people
/// cut off by the frame edge; the whole person (0–100 %) makes the bib smaller in the tile.
let torsoRange: (top: Double, bottom: Double) = (0.10, 0.90)
/// Added either side of a person's width, as a part of it: bibs pinned off-centre or turned
/// sideways stick out of the person box. Measured on bench/: 0.2 and 0.3 read more of the
/// neighbours' bibs and list fewer right numbers.
let torsoSidePad = 0.10
/// Height every torso is scaled to in the mosaic: far bibs get enlarged, near ones shrunk.
/// Measured on bench/: 360 and 240 are faster but miss runners; capping the enlargement of far
/// people or a larger minimum text height didn't make it faster.
let mosaicTileHeight = 480.0

func torsoRegion(of person: Box) -> Box {
  let w = person.x1 - person.x0, h = person.y1 - person.y0
  return Box(x0: max(0, person.x0 - w * torsoSidePad), y0: max(0, person.y0 + h * torsoRange.top),
             x1: min(1, person.x1 + w * torsoSidePad), y1: min(1, person.y0 + h * torsoRange.bottom))
}

/// Person-first: find the people, then read text only on their torsos. Signage, banners and
/// cones are never read, and text recognition works on a fraction of the frame.
func readPeopleFirst(_ image: CGImage, people wantPeople: Bool, maxBib: Int) -> FrameReads {
  let humans = VNDetectHumanRectanglesRequest()
  humans.upperBodyOnly = false
  timed("humans") { try? VNImageRequestHandler(cgImage: image, options: [:]).perform([humans]) }
  let people = (humans.results ?? []).map { Box(visionRect: $0.boundingBox) }
  let reads = timed("text") { readRegionsMosaic(image, torsoRegions(image, people), maxBib: maxBib, tileHeight: mosaicTileHeight) }
  return FrameReads(bibs: reads, people: wantPeople ? people : [], rejectedByColor: 0)
}

/// The torsos worth reading: people too small to hold a readable bib (far down the road) are skipped.
func torsoRegions(_ image: CGImage, _ people: [Box]) -> [Box] {
  let frameH = Double(image.height), frameW = Double(image.width)
  return people.map(torsoRegion).filter { ($0.y1 - $0.y0) * frameH >= 28 && ($0.x1 - $0.x0) * frameW >= 16 }
}

/// Several regions of a frame cut out, scaled to the same height (far-away bibs get enlarged,
/// close ones shrunk) and tiled into one small picture, so one text-recognition call reads them all.
struct Mosaic {
  let image: CGImage
  /// Each region's crop in frame pixels and where it sits in the mosaic (top-down pixels).
  let tiles: [(crop: CGRect, rect: CGRect)]
  let tileHeight: Double
}

func makeMosaic(_ image: CGImage, _ regions: [Box], tileHeight: Double = 240, maxWidth: Double = 1600) -> Mosaic? {
  guard !regions.isEmpty else { return nil }
  let gap = 16.0
  let fw = Double(image.width), fh = Double(image.height)
  // Lay the tiles out in rows (top-down layout coordinates).
  var tiles: [(crop: CGRect, rect: CGRect)] = []
  var x = gap, y = gap, rowBottom = gap
  for r in regions {
    let crop = CGRect(x: r.x0 * fw, y: r.y0 * fh, width: (r.x1 - r.x0) * fw, height: (r.y1 - r.y0) * fh).integral
    guard crop.width > 2, crop.height > 2 else { continue }
    let scale = tileHeight / crop.height
    let w = min(crop.width * scale, maxWidth - 2 * gap)
    if x + w > maxWidth - gap, x > gap { x = gap; y = rowBottom + gap }
    tiles.append((crop, CGRect(x: x, y: y, width: w, height: tileHeight)))
    x += w + gap
    rowBottom = max(rowBottom, y + tileHeight)
  }
  guard !tiles.isEmpty else { return nil }
  let W = Int(tiles.map { $0.rect.maxX }.max()! + gap), H = Int(rowBottom + gap)
  guard let ctx = CGContext(data: nil, width: W, height: H, bitsPerComponent: 8, bytesPerRow: 0,
                            space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return nil }
  ctx.setFillColor(CGColor(gray: 0, alpha: 1))
  ctx.fill(CGRect(x: 0, y: 0, width: W, height: H))
  ctx.interpolationQuality = .high
  for t in tiles {
    guard let cut = image.cropping(to: t.crop) else { continue }
    // CoreGraphics origin is bottom-left.
    ctx.draw(cut, in: CGRect(x: t.rect.minX, y: Double(H) - t.rect.maxY, width: t.rect.width, height: t.rect.height))
  }
  guard let mosaic = ctx.makeImage() else { return nil }
  return Mosaic(image: mosaic, tiles: tiles, tileHeight: tileHeight)
}

/// Every number read in a mosaic, with its box in frame fractions and in the mosaic (top-down
/// pixels). A number may appear more than once (several candidates, several tiles).
func readMosaic(_ m: Mosaic, frameWidth fw: Double, frameHeight fh: Double, maxBib: Int) -> [(read: BibRead, inMosaic: CGRect)] {
  let W = Double(m.image.width), H = Double(m.image.height)
  let req = VNRecognizeTextRequest()
  req.recognitionLevel = .accurate
  req.usesLanguageCorrection = false
  req.minimumTextHeight = Float(m.tileHeight * 0.06 / H)   // digits are ≥ ~6 % of a torso's height
  try? VNImageRequestHandler(cgImage: m.image, options: [:]).perform([req])

  var out: [(read: BibRead, inMosaic: CGRect)] = []
  for obs in req.results ?? [] {
    // Vision boxes are normalised with a bottom-left origin; tile rects are top-down.
    let bb = obs.boundingBox
    let mx0 = bb.minX * W, mx1 = bb.maxX * W
    let my0 = (1 - bb.maxY) * H, my1 = (1 - bb.minY) * H
    guard let t = m.tiles.first(where: { $0.rect.contains(CGPoint(x: (mx0 + mx1) / 2, y: (my0 + my1) / 2)) }) else { continue }
    func frameX(_ v: Double) -> Double { (t.crop.minX + (v - t.rect.minX) / t.rect.width * t.crop.width) / fw }
    func frameY(_ v: Double) -> Double { (t.crop.minY + (v - t.rect.minY) / t.rect.height * t.crop.height) / fh }
    let box = Box(x0: frameX(mx0), y0: frameY(my0), x1: frameX(mx1), y1: frameY(my1))
    let inMosaic = CGRect(x: mx0, y: my0, width: mx1 - mx0, height: my1 - my0)
    var seen = Set<String>()
    for cand in obs.topCandidates(3) {
      for (bib, fragment) in BibText.numbers(cand.string, maxBib: maxBib) where !seen.contains(bib) {
        seen.insert(bib)
        out.append((BibRead(bib: bib, box: box, confidence: Double(cand.confidence), fragment: fragment ? true : nil), inMosaic))
      }
    }
  }
  return out
}

/// Reads text in several regions of a frame with one text-recognition call (see `Mosaic`).
/// Boxes are mapped back to frame coordinates. One read per bib per frame.
func readRegionsMosaic(_ image: CGImage, _ regions: [Box], maxBib: Int, tileHeight: Double = 240, maxWidth: Double = 1600) -> [BibRead] {
  guard let m = makeMosaic(image, regions, tileHeight: tileHeight, maxWidth: maxWidth) else { return [] }
  var best: [String: BibRead] = [:]
  for (read, _) in readMosaic(m, frameWidth: Double(image.width), frameHeight: Double(image.height), maxBib: maxBib) {
    if best[read.bib].map({ $0.confidence < read.confidence }) ?? true { best[read.bib] = read }
  }
  return Array(best.values)
}
