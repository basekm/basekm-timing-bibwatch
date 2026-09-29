# bibwatch

Finds race bibs in finish-line video, follows each runner, and decides who actually
crossed the mat — then lets you watch the video with those detections drawn on top,
with a running reader clock.

Built for checking chip-timing results (missed reads, no-shows, disputes) against
footage. **Everything runs on this Mac** (AVFoundation + Apple Vision). No frames are
saved and nothing is uploaded; the viewer opens the video straight from disk.

## Build

```bash
swift build -c release        # binary: .build/release/bibwatch
cd server && npm install      # the viewer's local server (NestJS, Node 22)
```

## Quick start (from the viewer)

```bash
swift build -c release
mkdir -p media && ln -s "/path/GX011760.MP4" media/     # videos (symlinks are fine)
cp targets.txt media/                                  # optional: bib numbers to highlight
cd server && npm install && npm run build
MEDIA_FOLDER=../media npm run start:prod               # http://127.0.0.1:8765/
```

Or put `MEDIA_FOLDER` (and `PORT`) in `server/.env.development` / `.env.production`
(see `server/.env.example`); `npm run dev` rebuilds and restarts on changes.

1. Pick the video from **Library**.
2. **Run scan** — progress is shown under the playback bar (finding camera positions →
   reading bibs → following runners); results load by themselves when it's done.
3. Mark the mat for each camera position where it's visible (**M**) — optional: without a
   mat, bibs there are tagged **001 Viewed** instead of **000 Crossed the mat**; split camera positions if needed
   (**S**), set the clock. Every change **re-syncs instantly**: crossings are
   re-decided from the reads already made, no re-scan needed (also **R** / *Re-sync*).
4. If a change needs frames that were never read, those sightings show as `needs-scan` and **Run scan (update)** is highlighted —
   it only reads the missing frames and adds them to what's there.

Reads accumulate per video in `media/scans/<video>/detections.json` (with the segments you
sent in `segments.json`). Cancelling a scan discards that run's new reads.

## Search all videos

**Search all videos** (side panel) finds a bib, or a tag, in every video of the media folder:
type `147` (finds 0147) or `finisher`; click a result to open that video at that moment.
Results are sorted by reader time, so set the clock (**Set clock…**) on each video to line up
the same runner across cameras. API: `GET /api/sightings?bib=147` or `?tag=finisher`.

This comes from the server's SQLite database, `<media>/bibwatch.sqlite` (or
`DATABASE_SQLITE_FILE`): the sightings of every video as last decided (a finished scan, or a
re-sync in the viewer), your tags and each video's clock. `detections.json` stays the scanner's
output; on start the server reads in any that are newer than what it has, and any `tags.json`
from before tags moved into the database.

## Bib templates (less noise, faster)

A template is one bib design, **measured — not trained**: band colour, digit colour, digit
size and the bib-number range. With templates ticked, a scan first finds white digits sitting
on that band colour (a few ms per frame) and only reads those areas, enlarged — so shirt
logos, the "2026" in the bib logo, signage and other text are never read at all.

In the viewer's **Bib templates** panel:
- **+ From design image** — the bib artwork (PNG/JPEG); give it a name and number range.
- **+ From a bib in the video** — click the number of one clear bib (when you have no artwork).
- **Calibrate** — click 3–5 clear bibs of that design in the footage (sunlit and shaded);
  it adjusts the colours and sizes to how they look on camera. Esc when done.
- Tick every design used at the event (e.g. 5K pink and 1K teal) — several work together;
  each read is labelled with the design that found it.
- **Show what the templates find** — dashed boxes on the paused frame, to check nothing
  but bib numbers is picked up.

Command line: `bibwatch template design.png t.json --name "5K" --max-bib 250`,
`bibwatch template --from-video V --at t,x,y t.json`, `bibwatch calibrate t.json V --at t,x,y …`,
`bibwatch finder V --template t.json [--template …] --at t`, and `scan … --template t.json …`.

## Tags

Every bib seen gets a **numbered tag** — the mat is optional:

| Code | Tag | When |
|---|---|---|
| 000 | Crossed the mat | mat marked, the runner's feet cross it toward the camera |
| 001 | Viewed | bib seen on screen, no crossing decided — e.g. no mat marked for that camera position |
| 002 | Near the mat | on or near the mat without a clear crossing (photos, waiting) |
| 003 | Passing | seen, never close to the mat |
| 004 | Camera moving | older scans only: every bib is now captured and tagged the same, camera moving or not |
| 005 | Duplicate | same crossing as another bib (a misread) — the note says which |

Plus detail on each sighting: **zone** (background / before-mat / on-mat / past-mat),
**direction** (toward / away / still) and the **design** (template) it was read with.

Your own tags start at **100**: select a sighting (in the list, or click its box on the video)
and press **1–4** — 100 finisher, 101 photo, 102 misread, 103 wrong bib — or type any tag;
it gets the next free code (104, 105 …), remembered per video. Tags save per video
(in the database, see *Search all videos*); filter the list by any tag; **CSV** exports every sighting with
`tag_code`, `tag`, your tags and the detail.

## Workflow (command line)

### 1. Find the camera positions

```bash
.build/release/bibwatch segments "/path/GX011760.MP4" out/segments_GX011760.json
```

Splits the video wherever the camera was moved (or handled), and ignores people walking
past the lens. Output: `fixed` segments (camera still) and `moving` segments. These only
separate camera positions, each with its own mat: bibs are captured the same everywhere.

### 2. Mark the mat (viewer, optional)

Without a mat, bibs in that camera position are tagged **001 Viewed**; with one, the scan also
decides who **crossed** it. Open the viewer (see below) with the video and `segments_*.json`.
For each **fixed** segment where the mat is visible (green on the timeline, grey = no mat):

1. Go to a moment where the mat is visible.
2. Press **M** (or *Mark mat*) and click the two ends of the **near edge of the black mat**
   (the edge runners step onto first). It can be slanted.
3. Click **Export segments.json**.

The automatic split can be off by a few seconds, or miss a move. Correct it in the viewer:

- **M in a "moving" stretch** makes it still from that moment (joined with the still
  segment that follows), then you mark the mat.
- **S — Split here**: start a new segment at the playhead (e.g. the camera was bumped),
  then re-mark the mat on the new part.

Edits are kept in the exported `segments.json`; re-run `scan` with it.

### 3. Set the clock (optional but recommended)

GoPro clocks are unreliable. Pause on a known finisher crossing the mat, click
**Set clock…** and enter that runner's reader time (e.g. `05:57:58`). The server saves
it per video (search uses it too). Use the same value for `--clock` in step 4 = reader time at video 0:00
(the viewer shows it: reader time − video time).

### 4. Scan

```bash
.build/release/bibwatch scan "/path/GX011760.MP4" out/GX011760 \
  --segments segments_GX011760.json \
  --targets targets.txt \
  --clock 06:06:13
```

| Option | Default | Meaning |
|---|---|---|
| `--segments` | — | camera segments with mats (from steps 1–2) |
| `--mat X0,Y0,X1,Y1` | — | instead of `--segments`: one mat line for the whole video (frame fractions) |
| `--targets` | — | bib numbers to highlight (e.g. claimed but never read) |
| `--clock` | — | reader time at video 0:00 |
| `--every` | 0.5 | coarse pass: seconds between frames |
| `--fine-fps` | 10 | fine pass around each sighting |
| `--pad` | 4 | seconds before/after a sighting to track |
| `--start` / `--end` | whole video | scan part of the video |
| `--max-bib` | 250 | highest bib number in the race |
| `--no-color` | off | disable the bib-colour check |

Writes `detections.json` (for the viewer) and `crossings.csv`. Running it again into the
same `outDir` reuses every frame already read there (same settings) and only reads new
ones; `--fresh` starts over. `--progress json` prints machine-readable progress.

Labels: `crossed` (with interpolated time), `lingering` (on/near the mat, no clear
crossing), `passing` (never near the mat), `no-person`, `unclear`, `no-mat`
(older scans also have `camera-moving`).

### 5. Watch it

Load the video and `detections.json` in the viewer:

- **Running clock**: video time + reader time on the video and in the side panel.
- **Live boxes**: bibs (blue; green = crossed; red = target), people (thin white),
  the mat line (yellow dashed), a banner when a runner crosses.
- **List**: every sighting with label, video and reader time. Click to jump there.
  Filters: all / crossed / targets / not crossed, and bib search.
- **Scrubber** (QuickTime-style): drag anywhere and the picture follows; hover shows the
  video and reader time; elapsed/remaining on either side. The bar also shows camera
  positions (green = mat marked, grey = no mat) and crossing ticks.
- **Trackpad / Magic Mouse**: swipe sideways over the video to scrub. **Swipe speed**
  slider sets how far a swipe goes (shown as seconds per typical swipe, from ≈0.3 s for
  frame-by-frame work to ≈30 s; default ≈1.5 s), **reverse** flips the direction; both are
  remembered in the browser. Hold `⌥ Option` for 10× faster. On the bar, swiping or scrolling moves the
  playhead like dragging it. The video pauses while you swipe and resumes after if it
  was playing; the browser's swipe-to-go-back is disabled on this page.
- **Keys**: `Space` play/pause · `←/→` 0.1 s · `Shift+←/→` 1 s · `J`/`K`/`L` back 1 s /
  pause / play (press `L` again for 2× and 4×) · `[`/`]` previous/next sighting · `M` mark mat.

## Opening the viewer

Either open `viewer/index.html` directly in Safari/Chrome and pick (or drag in) the video
and JSON, or serve it locally (needed for `?video=&data=` links and the Run scan button):

```bash
cd server && MEDIA_FOLDER=../out/media npm run start:prod    # binds 127.0.0.1 only
# http://127.0.0.1:8765/?video=/media/GX011759.MP4&data=/media/detections.json
```

Put the video (a symlink is fine) and JSON in the `MEDIA_FOLDER`.

The server (`server/`) is a NestJS app laid out like `basekm-timing-backend`: one module per
area (`media`, `scans`, `templates`, `bibwatch` runs the Swift binary), DTOs and constants in
`src/@shared`. It serves the viewer at `/`, the media folder at `/media/` (with HTTP Range, so
video seeking works) and the API at `/api/`.

GoPro files are HEVC. Safari and Chrome on macOS play them. If a browser can't, make a
proxy — timing stays identical and the boxes still line up:

```bash
ffmpeg -i GX011760.MP4 -vf scale=1280:-2 -c:v libx264 -preset veryfast -crf 23 -an proxy.mp4
```

## How it decides

- **Bib reads**: Vision text recognition; 4-digit numbers `0001`–`max-bib`, plus 3-digit
  fragments (a digit hidden behind someone). The **bib-colour check** keeps only white
  digits on the magenta 5K band — drops shirt logos, the "2026" in the bib logo, signage,
  and other categories' bibs.
- **Crossing**: the runner's feet (bottom of their person box) move from clearly before
  the mat's near edge onto/over it, toward the camera, within the mat's width. The runner
  is followed forwards and backwards from the frames where the bib is readable.
- **Camera moves**: the frame is compared cell by cell over time; a move changes almost
  every cell, a person near the lens only some.

## Known limitations (next)

- **Fragments**: "014" read from bib 0147 can get the same crossing as 0147. Prefer the full
  4-digit read on the same bib.
- **Logos on the back of pink singlets** can pass the colour check (e.g. "104"). Require
  large digits dominating the band, "5KM", or a confident read.
- Short "fixed" pieces can remain around busy camera handling. Marking the same mat on
  them is fine.
