import Foundation

func die(_ message: String) -> Never {
  FileHandle.standardError.write((message + "\n").data(using: .utf8)!)
  exit(1)
}

/// `--progress json`: one JSON object per line on stderr (for the viewer's Run scan button)
/// instead of a human-readable status line.
var progressJSON = false

func progress(_ message: String, phase: String? = nil, done: Double = 0, total: Double = 0, eta: Double? = nil, at: Double? = nil) {
  if progressJSON, let phase {
    var obj: [String: Any] = ["phase": phase, "done": done, "total": total]
    if let eta { obj["eta"] = eta.rounded() }
    if let at { obj["at"] = (at * 10).rounded() / 10 }   // video time being read now
    if let data = try? JSONSerialization.data(withJSONObject: obj) {
      FileHandle.standardError.write(data + "\n".data(using: .utf8)!)
    }
    return
  }
  FileHandle.standardError.write(("\r" + message + "   ").data(using: .utf8)!)
}

func progressDone() {
  if !progressJSON { FileHandle.standardError.write("\n".data(using: .utf8)!) }
}

/// "mm:ss", "hh:mm:ss" or "hh:mm:ss.s" → seconds.
func parseTime(_ s: String) -> Double {
  s.split(separator: ":").compactMap { Double($0) }.reduce(0) { $0 * 60 + $1 }
}

func formatTime(_ t: Double, tenths: Bool = false) -> String {
  let whole = Int(t.rounded(.down))
  let base = String(format: "%02d:%02d:%02d", whole / 3600, (whole / 60) % 60, whole % 60)
  return tenths ? base + String(format: ".%d", Int((t - Double(whole)) * 10)) : base
}

/// Simple `--flag value` / `--switch` argument reader.
struct Args {
  var positional: [String] = []
  var options: [String: String] = [:]
  /// Every value of options that may be repeated (e.g. several --template).
  var all: [String: [String]] = [:]
  var switches: Set<String> = []

  init(_ raw: [String], switches known: Set<String>) {
    var i = 0
    while i < raw.count {
      let a = raw[i]
      if a.hasPrefix("--") {
        let key = String(a.dropFirst(2))
        if known.contains(key) { switches.insert(key); i += 1; continue }
        guard i + 1 < raw.count else { die("missing value for \(a)") }
        options[key] = raw[i + 1]
        all[key, default: []].append(raw[i + 1])
        i += 2
      } else {
        positional.append(a)
        i += 1
      }
    }
  }

  func double(_ key: String, _ fallback: Double) -> Double { options[key].flatMap(Double.init) ?? fallback }
}

/// Box in top-left-origin fractions of the frame.
struct Box: Codable {
  var x0: Double, y0: Double, x1: Double, y1: Double
  var cx: Double { (x0 + x1) / 2 }
  var cy: Double { (y0 + y1) / 2 }
  var area: Double { (x1 - x0) * (y1 - y0) }
  func contains(_ x: Double, _ y: Double) -> Bool { x >= x0 && x <= x1 && y >= y0 && y <= y1 }

  init(x0: Double, y0: Double, x1: Double, y1: Double) { self.x0 = x0; self.y0 = y0; self.x1 = x1; self.y1 = y1 }
  init(visionRect r: CGRect) { self.init(x0: r.minX, y0: 1 - r.maxY, x1: r.maxX, y1: 1 - r.minY) }

  // Stored compactly as [x0, y0, x1, y1] rounded to 4 decimals.
  init(from decoder: Decoder) throws {
    let v = try decoder.singleValueContainer().decode([Double].self)
    self.init(x0: v[0], y0: v[1], x1: v[2], y1: v[3])
  }
  func encode(to encoder: Encoder) throws {
    var c = encoder.singleValueContainer()
    try c.encode([x0, y0, x1, y1].map { ($0 * 10000).rounded() / 10000 })
  }
}

/// The mat's near edge as a line in frame fractions (may be slanted).
/// "Before the mat" is the side away from the camera (smaller y).
struct MatLine: Codable {
  var x0: Double, y0: Double, x1: Double, y1: Double

  var minX: Double { min(x0, x1) }
  var maxX: Double { max(x0, x1) }

  /// y of the line at x (clamped to the line's extent).
  func y(at x: Double) -> Double {
    guard x1 != x0 else { return (y0 + y1) / 2 }
    let f = min(max((x - x0) / (x1 - x0), 0), 1)
    return y0 + (y1 - y0) * f
  }

  /// Signed vertical distance of a point below (+) / above (−) the line.
  func depth(_ x: Double, _ y: Double) -> Double { y - self.y(at: x) }
}

struct Segment: Codable {
  var index: Int
  var from: Double
  var to: Double
  /// "fixed" = camera still; "moving" = being repositioned (no crossings counted).
  var kind: String
  /// A representative still frame time for marking the mat.
  var refTime: Double
  /// Mat line for this camera position; nil = mat not marked / not visible.
  var mat: MatLine?
}

struct SegmentsFile: Codable {
  var video: String
  var duration: Double
  var segments: [Segment]
}

func readJSON<T: Decodable>(_ type: T.Type, _ path: String) -> T {
  guard let data = FileManager.default.contents(atPath: path) else { die("cannot read \(path)") }
  do { return try JSONDecoder().decode(type, from: data) } catch { die("invalid JSON in \(path): \(error)") }
}

func tryReadJSON<T: Decodable>(_ type: T.Type, _ path: String) -> T? {
  guard let data = FileManager.default.contents(atPath: path) else { return nil }
  return try? JSONDecoder().decode(type, from: data)
}

func writeJSON<T: Encodable>(_ value: T, _ path: String) {
  let enc = JSONEncoder()
  enc.outputFormatting = [.sortedKeys]
  do { try enc.encode(value).write(to: URL(fileURLWithPath: path), options: .atomic) } catch { die("cannot write \(path): \(error)") }
}
