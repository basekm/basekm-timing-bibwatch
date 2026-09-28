import Foundation

let usage = """
  bibwatch — find race bibs in finish-line video and decide who crossed the mat.
  Everything runs on this Mac (AVFoundation + Vision). No frames are saved or uploaded.

    bibwatch segments <video> <segments.json>       find camera moves; mark mats in the viewer
    bibwatch scan <video> <outDir> [options]         find bibs, track runners, detect crossings
    bibwatch template <design.png> <template.json>  measure a bib design (colours, digits)
    bibwatch calibrate <template.json> <video> --at t,x,y …   tune it on clear bibs in the footage
    bibwatch finder <video> --template T --at t     what the template finds in one frame (JSON)

  Run a command without arguments for its options. See README.md for the full workflow.
  """

var arguments = Array(CommandLine.arguments.dropFirst())
guard let command = arguments.first else { print(usage); exit(0) }
arguments.removeFirst()

switch command {
case "segments": runSegments(arguments)
case "scan": runScan(arguments)
case "template": runTemplate(arguments)
case "calibrate": runCalibrate(arguments)
case "finder": runFinder(arguments)
case "-h", "--help", "help": print(usage)
default: die("unknown command '\(command)'\n\n" + usage)
}
