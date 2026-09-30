# bibwatch

Finds race bibs in finish-line video, follows each runner, and decides who actually
crossed the mat — then lets you watch the video with those detections drawn on top,
with a running reader clock.

Built for checking chip-timing results (missed reads, no-shows, disputes) against
footage. **Everything runs on this Mac** (AVFoundation + Apple Vision). No frames are
saved and nothing is uploaded; the viewer opens the video straight from disk.

## Build

```bash
swift build -c release                  # binary: .build/release/bibwatch
cd web && npm install && npm run build  # the viewer (Next.js, its own process)
cd server && npm install                # the API and media server (NestJS, Node 22)
```

## Quick start (from the viewer)

```bash
swift build -c release
mkdir -p media && ln -s "/path/GX011760.MP4" media/     # videos (symlinks are fine)
cp targets.txt media/                                  # optional: bib numbers to watch
(cd server && npm install && npm run build && MEDIA_FOLDER=../media npm run start:prod) &   # API on :8765
cd web && npm install && npm run build && npm run start                                     # http://localhost:3000/
```

Or put `MEDIA_FOLDER` (and `PORT`) in `server/.env.development` / `.env.production`
(see `server/.env.example`); `npm run dev` rebuilds and restarts on changes.

1. Pick the video from the **Video** list at the top.
2. **Run scan** (top right) — progress is shown next to it (finding camera positions →
   reading bibs → following runners); runners appear in the list as they are found.
3. **Mark finish line** for each camera position where it's visible (**M**) — optional: without a
   finish line, bibs there are tagged **001 Viewed** instead of **000 Crossed the mat**; split camera positions if needed
   (**S**), set the race clock. Every change applies **instantly**: finishes are
   re-decided from the reads already made, no re-scan needed.
4. If a change needs frames that were never read, those runners show *Not read here yet* —
   **Scan again** only reads the missing frames and adds them to what's there.

Reads accumulate per video in `media/scans/<video>/detections.json` (with the segments you
sent in `segments.json`). Cancelling a scan discards that run's new reads.

### People only (on by default)

**⋯ More › Only look for people** finds people first and reads bibs only on their torsos:
each torso is cut out, scaled to the same height (small, distant bibs get enlarged) and read
in one picture, so banners, cones and signs are never read. It's on for videos not scanned
yet; a video keeps the way its saved scan was made. Untick it to read the whole frame.
Changing the box scans the video again from the start.

Measured (`bench/run.sh`, 31 hand-checked runners on two Chubb clips): people only lists 30,
whole frame 27; wrong numbers listed 6 vs 4; 152 s vs 167 s. On a later stretch of the same
race with other runners: 9 runners each, 73 s vs 112 s. Command line: `scan … --people-first`; add `--profile` to see
where the time goes.

## Search all videos

**All videos** (above the runner list) finds a bib, or a tag, in every video of the media folder:
type `147` (finds 0147) or `finisher`; click a result to open that video at that moment.
Results are sorted by reader time, so set the race clock (**Set…** on the video) on each video to line up
the same runner across cameras. API: `GET /api/sightings?bib=147` or `?tag=finisher`.

This comes from the server's SQLite database, `<media>/bibwatch.sqlite` (or
`DATABASE_SQLITE_FILE`): the sightings of every video as last decided (a finished scan, or a
re-sync in the viewer), your tags and each video's clock. `detections.json` stays the scanner's
output; on start the server reads in any that are newer than what it has, and any `tags.json`
from before tags moved into the database.

## The viewer at a glance

The viewer is a Next.js app in `web/` (shadcn/ui + Tailwind, laid out and themed like
`basekm-timing-engine-web`), run as its own process next to the server.

- **Header**: the video list, how many runners were spotted, *Saved automatically*, the scan
  status and **Run scan / Scan again / Stop scan**, **All cameras**, and **⋯ More**.
- **Video**: boxes and bib numbers drawn on top, the race clock (top left), play, ±1 s, speed.
- **Timeline** (under the video): every runner as a marker, camera positions underneath;
  Ctrl + scroll (or the slider) zooms, **Fit all** zooms out.
- **Mark and annotate**: previous / next runner, **Mark finish line**, **Split camera position here**.
- **Runners spotted** (right): All / Finished / Watchlist / Not yet finished, search, movement,
  **CSV**, and **This video / All videos**. Select a runner to tag it.
- **⋯ More**: open files, bib numbers, race clock, split, download segments.json,
  people-only scanning, what to draw on the video, trackpad settings, keyboard shortcuts, and
  clear scans.

## All cameras (review footage together)

**All cameras** (header) shows several videos side by side on one race clock: play, scrub, step
or change speed once and every camera follows. Each camera is lined up by its race clock (the same
one as **Set…** in the viewer), saved per video:

- **Set race clock…** on one camera, at a moment you know the race time of (a chip read).
- On the others, move the video to the moment the linked cameras show and press **Match**.
  **Line up** redoes it for a camera that's already linked.
- The lanes under the videos show what part of the race each camera recorded; a camera that
  wasn't recording at that moment shows when it starts or ended.
- Click a video to open it in the viewer at that moment (scans, runners and tags as usual);
  **All cameras** brings you back to the same moment.

Keys: Space play / pause, ← → 5 s, `,` `.` 0.1 s. Pick the videos in the cameras menu (top right).

## Bib numbers (per event)

**⋯ More › Bib numbers…** sets how many digits bib numbers have at this event — races can mix
lengths (e.g. 4 to 6: 4-digit 5K bibs, 6-digit marathon bibs) — and optionally the lowest and
highest bib. It is saved in the event's database (the media folder), so every video of the event
is scanned with it. A number one digit shorter than the fewest is kept as a partial read.
The classic 4 digits keeps the zero-padding earlier scans use ("147" is stored as "0147").

Put the participant list in the media folder as **`registered.txt`** (one bib number per line,
next to the videos). Bibs not in it are tagged *006 Not registered*, and with no highest bib set
the highest registered number is used. With mixed lengths it matters most: only the list tells a
5-digit bib from a 6-digit one with a digit hidden. Changing the rules makes the next scan of
each video read it again from the start. Command line: `scan … --digits 4-6 [--min-bib N]`.

## Tags

Every bib seen gets a **numbered tag** — the mat is optional:

| Code | Tag | When |
|---|---|---|
| 000 | Crossed the mat | mat marked, the runner's feet cross it toward the camera |
| 001 | Viewed | bib seen on screen, no crossing decided — e.g. no mat marked for that camera position |
| 002 | Near the mat | on or near the mat without a clear crossing (photos, waiting) |
| 003 | Passing | seen, never close to the mat |
| 004 | Camera moving | older scans only: every bib is now captured and tagged the same, camera moving or not |
| 005 | Duplicate | the same runner read as another number (a misread) — the note says which |

Plus detail on each sighting: **zone** (background / before-mat / on-mat / past-mat),
and **direction** (toward / away / still).

Your own tags start at **100**: select a runner (in the list, on the timeline, or click its bib on the video)
and press **1–4** — 100 finisher, 101 photo, 102 misread, 103 wrong bib — or type any tag;
it gets the next free code (104, 105 …), remembered per video. Tags save per video
(in the database, see *Search all videos*); search the list by any tag; **CSV** exports every sighting with
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
For each camera position where the mat is visible (green on the timeline, blue = no finish line yet):

1. Go to a moment where the mat is visible.
2. Press **M** (or *Mark finish line*) and click the two ends of the **near edge of the black mat**
   (the edge runners step onto first). It can be slanted.
3. Finish lines are saved as you mark them; **⋯ More › Download a copy (segments.json)** saves a copy.

The automatic split can be off by a few seconds, or miss a move. Correct it in the viewer:

- **M in a "moving" stretch** makes it still from that moment (joined with the still
  segment that follows), then you mark the mat.
- **S — Split camera position here** (also in **⋯ More**): start a new segment at the playhead (e.g. the camera was bumped),
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

- **Race clock**: reader time on the video (top left), and next to each runner.
- **Live boxes**: bib numbers (blue; green = finished; red = watchlist), people (thin white),
  the finish line (yellow dashed), a banner when a runner finishes.
- **Runners spotted**: every runner with video and reader time. Click to jump there.
  Filters: all / finished / watchlist / not yet finished, movement, and bib or tag search.
- **Scrubber** (on the video): drag anywhere and the picture follows; hover shows the
  video and reader time.
- **Timeline**: a marker per runner (green = finished, red = watchlist), camera positions
  underneath (green = finish line marked), not-yet-scanned parts hatched. Click or drag to move
  the playhead; Ctrl + scroll zooms.
- **Trackpad / Magic Mouse**: swipe sideways over the video to scrub. **Swipe speed** (in **⋯ More**)
  slider sets how far a swipe goes (shown as seconds per typical swipe, from ≈0.3 s for
  frame-by-frame work to ≈30 s; default ≈1.5 s), **reverse** flips the direction; both are
  remembered in the browser. Hold `⌥ Option` for 10× faster. On the bar, swiping or scrolling moves the
  playhead like dragging it. The video pauses while you swipe and resumes after if it
  was playing; the browser's swipe-to-go-back is disabled on this page.
- **Keys**: `Space` play/pause · `←/→` 0.1 s · `Shift+←/→` 1 s · `J`/`K`/`L` back 1 s /
  pause / play (press `L` again for 2× and 4×) · `[`/`]` previous/next runner · `M` mark finish line ·
  `S` split · `1`–`4` tag · `Esc` stop marking.

### 6. Measure accuracy (answer keys)

To compare reading methods (whole frame, people only), score them against a
hand-checked list of the bibs in a stretch of video:

```bash
# 1. Scan the stretch each way, into separate folders
bibwatch scan clip.mp4 out/whole  --start 2:30 --end 3:00 --no-color --max-bib 9999
bibwatch scan clip.mp4 out/people --start 2:30 --end 3:00 --no-color --max-bib 9999 --people-first

# 2. Check by hand every number either scan read (close-ups from the video), save key.txt
bibwatch review out/review out/whole out/people --video clip.mp4 --start 2:30 --end 3:00
open out/review/review.html

# 3. Score: bibs found / missed, wrong numbers, share of single-frame reads that were right
bibwatch score key.txt out/whole out/people

# 4. Why was a number wrong? The torsos picture "people only" read at that moment
bibwatch mosaic clip.mp4 out/mosaic.png --at 68.2 --max-bib 9999 --key key.txt
```

A key is one bib per line; `# range: 02:30-03:00` sets the stretch, and `0147?` marks a bib
you couldn't confirm (not counted either way). `bench/run.sh` runs all of this on the two
hand-checked Chubb clips in `bench/keys` (and checks the viewer decides sightings exactly as
the scanner does); run it after any change to reading or deciding. `--ai` adds an AI check's reads to the review
page. The review page's close-ups are the only frames bibwatch writes to disk.

## Opening the viewer

The viewer and the server are two processes. Start the server (the API and the media), then
the viewer; the viewer passes `/api` and `/media` on to the server, so the browser only talks
to the viewer:

```bash
cd server && MEDIA_FOLDER=../out/media npm run start:prod    # :8765, binds 127.0.0.1 only
cd web && npm run build && npm run start                     # http://localhost:3000
# http://localhost:3000/?video=/media/GX011759.MP4&data=/media/detections.json
```

The server's address is `BIBWATCH_SERVER_URL` (default http://127.0.0.1:8765; see
`web/.env.example`). It is fixed into the build, so set it before `npm run build`. The viewer
starts without the server, but the video list, scans and saving need it.

Put the video (a symlink is fine) and JSON in the `MEDIA_FOLDER`. Without a media folder you
can still drop a video and its JSON on the page (or **⋯ More › Open video file…**); nothing is
uploaded.

Working on the viewer: `cd web && npm run dev` instead of build + start —
http://localhost:3000 with hot reload. The app follows
`basekm-timing-engine-web` (structure, shadcn/ui primitives, theme); see `web/.agents/skills/`.

The server (`server/`) is a NestJS app laid out like `basekm-timing-backend`: one module per
area (`media`, `scans`, `bibwatch` runs the Swift binary), DTOs and constants in
`src/@shared`. It serves the media folder at `/media/` (with HTTP Range, so
video seeking works) and the API at `/api/`.

GoPro files are HEVC. Safari and Chrome on macOS play them. If a browser can't, make a
proxy — timing stays identical and the boxes still line up:

```bash
ffmpeg -i GX011760.MP4 -vf scale=1280:-2 -c:v libx264 -preset veryfast -crf 23 -an proxy.mp4
```

## How it decides

- **Bib reads**: Vision text recognition; 4-digit numbers `0001`–`max-bib`, plus 3-digit
  fragments (a digit hidden behind someone). Letters that look like digits count ("5O19"),
  but not inside a word ("CHUBB" is not 188). The **bib-colour check** keeps only white
  digits on the magenta 5K band — drops shirt logos, the "2026" in the bib logo, signage,
  and other categories' bibs.
- **One runner, one number**: a number read on the same bib as a number read more often
  (within 0.6 s, less than a bib width away) that is part of it ("516" of 5161) or one digit
  off (5164) is tagged 005 Duplicate of it. Runners side by side with close numbers
  (3088, 3089) both stay: their bibs are apart. A number never read in full — only as
  3-digit fragments — isn't listed.
- **Crossing**: the runner's feet (bottom of their person box) move from clearly before
  the mat's near edge onto/over it, toward the camera, within the mat's width. The runner
  is followed forwards and backwards from the frames where the bib is readable.
- **Camera moves**: the frame is compared cell by cell over time; a move changes almost
  every cell, a person near the lens only some.

## Known limitations (next)

- **Consistent misreads**: when the reader gets a bib wrong more often than right (3150 for
  3156), the wrong number is listed and the right one folded into it.
- **Always-covered bibs**: a runner whose bib is only ever read as 3 digits isn't listed.
- **Logos on the back of pink singlets** can pass the colour check (e.g. "104"). Require
  large digits dominating the band, "5KM", or a confident read.
- Short "fixed" pieces can remain around busy camera handling. Marking the same mat on
  them is fine.
