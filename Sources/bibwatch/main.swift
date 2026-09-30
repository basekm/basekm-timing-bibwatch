import Foundation

let usage = """
  bibwatch — find race bibs in finish-line video and decide who crossed the mat.
  Everything runs on this Mac (AVFoundation + Vision). No frames are saved or uploaded.

    bibwatch segments <video> <segments.json>       find camera moves; mark mats in the viewer
    bibwatch scan <video> <outDir> [options]         find bibs, track runners, detect crossings
    bibwatch review <outDir> <scanDir>… --video V   page to check every bib read by hand → answer key
    bibwatch score <key.txt> <scanDir>…             compare scans with an answer key
    bibwatch mosaic <video> <out.png> --at t        what "people only" reads in one frame

  Run a command without arguments for its options. See README.md for the full workflow.
  """

var arguments = Array(CommandLine.arguments.dropFirst())
guard let command = arguments.first else { print(usage); exit(0) }
arguments.removeFirst()

switch command {
case "segments": runSegments(arguments)
case "scan": runScan(arguments)
case "review": runReview(arguments)
case "score": runScore(arguments)
case "mosaic": runMosaic(arguments)
case "-h", "--help", "help": print(usage)
default: die("unknown command '\(command)'\n\n" + usage)
}
