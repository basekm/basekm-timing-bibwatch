import Foundation

/// Where a scan's time goes, by stage (`scan … --profile`). Timing is always on (it costs
/// nanoseconds); the report is printed only when asked for.
enum Profile {
  static var enabled = false
  private static var seconds: [String: Double] = [:]
  private static var calls: [String: Int] = [:]
  private static var start: UInt64 = 0

  static func begin() { start = DispatchTime.now().uptimeNanoseconds }

  static func report() {
    guard enabled else { return }
    let total = Double(DispatchTime.now().uptimeNanoseconds - start) / 1e9
    var rows = seconds
    rows["other"] = max(0, total - seconds.values.reduce(0, +))
    var lines = [String(format: "profile: %.1f s total", total)]
    for (stage, s) in rows.sorted(by: { $0.value > $1.value }) {
      let n = calls[stage] ?? 0
      lines.append(String(format: "  %-10@ %7.1f s %5.1f%%  %6d calls  %6.1f ms/call", stage as NSString, s, 100 * s / max(total, 1e-9), n,
                          n > 0 ? 1000 * s / Double(n) : 0))
    }
    FileHandle.standardError.write((lines.joined(separator: "\n") + "\n").data(using: .utf8)!)
  }

  fileprivate static func add(_ stage: String, _ s: Double) {
    seconds[stage, default: 0] += s
    calls[stage, default: 0] += 1
  }
}

/// Runs `work`, adding its time to `stage` in the profile.
func timed<T>(_ stage: String, _ work: () -> T) -> T {
  let t0 = DispatchTime.now().uptimeNanoseconds
  let result = work()
  Profile.add(stage, Double(DispatchTime.now().uptimeNanoseconds - t0) / 1e9)
  return result
}
