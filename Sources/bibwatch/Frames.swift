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
    try? generator.copyCGImage(at: CMTime(seconds: t, preferredTimescale: 600), actualTime: nil)
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

/// Bib numbers in this race are 0001–0250. OCR often drops the leading 0 (or a digit is
/// hidden behind someone), so 3-digit runs are kept as fragments.
enum BibText {
  static let letterFix: [Character: Character] = ["O": "0", "o": "0", "D": "0", "Q": "0", "I": "1", "l": "1", "|": "1", "S": "5", "B": "8", "Z": "2"]

  static func candidates(_ text: String, maxBib: Int) -> [String] { numbers(text, maxBib: maxBib).map(\.bib) }

  /// Numbers in the text, with whether each was only a 3-digit fragment (padded to 4).
  static func numbers(_ text: String, maxBib: Int) -> [(bib: String, fragment: Bool)] {
    let fixed = String(text.map { letterFix[$0] ?? $0 })
    var out: [(String, Bool)] = [], run = ""
    for ch in fixed + " " {
      if ch.isNumber { run.append(ch); continue }
      if run.count == 4, let n = Int(run), (1...maxBib).contains(n) { out.append((run, false)) }
      if run.count == 3, let n = Int(run), (1...maxBib).contains(n) { out.append((String(format: "%04d", n), true)) }
      run = ""
    }
    return out
  }
}

struct BibRead: Codable {
  var bib: String
  var box: Box
  var confidence: Double
  /// Name of the bib template (design) that found it; nil for whole-frame reading.
  var template: String? = nil
  /// Read from only 3 digits (padded) — a partial number, e.g. "010" from a half-read "0109".
  var fragment: Bool? = nil
}

struct FrameReads {
  var bibs: [BibRead]
  var people: [Box]
  var rejectedByColor: Int
}

func readFrame(_ image: CGImage, people wantPeople: Bool, colorCheck: Bool, maxBib: Int, templates: [BibTemplate] = []) -> FrameReads {
  // Template mode: find number areas by each bib design's colours first, read only those.
  if !templates.isEmpty {
    var people: [Box] = []
    if wantPeople {
      let humans = VNDetectHumanRectanglesRequest()
      humans.upperBodyOnly = false
      try? VNImageRequestHandler(cgImage: image, options: [:]).perform([humans])
      people = (humans.results ?? []).map { Box(visionRect: $0.boundingBox) }
    }
    guard let px = Pixels(image) else { return FrameReads(bibs: [], people: people, rejectedByColor: 0) }
    return FrameReads(bibs: readCandidates(image, findAllCandidates(px, templates)), people: people, rejectedByColor: 0)
  }
  let text = VNRecognizeTextRequest()
  text.recognitionLevel = .accurate
  text.usesLanguageCorrection = false
  text.minimumTextHeight = 0.015
  let humans = VNDetectHumanRectanglesRequest()
  humans.upperBodyOnly = false
  try? VNImageRequestHandler(cgImage: image, options: [:]).perform(wantPeople ? [text, humans] : [text])

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
