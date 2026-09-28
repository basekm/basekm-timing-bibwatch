#!/usr/bin/env python3
"""Local server for the bibwatch viewer (127.0.0.1 only).

- Serves the viewer and the files in a media folder (with HTTP Range, so video seeks work).
- Lets the viewer start `bibwatch` scans and follow their progress (the Run scan button).

usage: python3 tools/serve.py --media "/path/to/folder with videos" [--port 8765]

Put videos (symlinks are fine) and, optionally, targets.txt (bib numbers to highlight) in the
media folder. Scan results accumulate in <media>/scans/<video name>/.
Then open http://127.0.0.1:8765/
"""
import argparse
import base64
import json
import mimetypes
import os
import re
import subprocess
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlparse

REPO = os.path.realpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
ROOT = os.path.join(REPO, "viewer")
BINARY = os.path.join(REPO, ".build", "release", "bibwatch")
VIDEO_EXT = (".mp4", ".mov", ".m4v")

TEMPLATE_LOCK = threading.Lock()   # template files are rewritten by calibrate
JOB_LOCK = threading.Lock()
JOB = None  # the one scan that may run at a time


class Job:
    def __init__(self, video, media):
        self.video = video
        self.stem = os.path.splitext(video)[0]
        self.dir = os.path.join(media, "scans", self.stem)
        self.state = "starting"      # starting | segments | scanning | done | failed | cancelled
        self.phase = None            # segments | coarse | fine
        self.done = 0
        self.total = 0
        self.eta = None
        self.message = ""
        self.summary = ""
        self.started = time.time()
        self.proc = None
        self.checkpoints = 0
        self.at = None           # video time being read now

    def status(self):
        det = os.path.join(self.dir, "detections.json")
        return {
            "checkpoint": os.path.getmtime(det) if os.path.exists(det) else None,
            "partial": f"/media/scans/{self.stem}/detections.json" if os.path.exists(det) else None,
            "video": self.video, "state": self.state, "phase": self.phase, "done": self.done, "total": self.total,
            "eta": self.eta, "at": self.at, "message": self.message, "summary": self.summary,
            "elapsed": round(time.time() - self.started),
            "result": f"/media/scans/{self.stem}/detections.json" if self.state == "done" else None,
        }

    def run_step(self, args):
        """Run one bibwatch command, following its JSON progress lines."""
        self.proc = subprocess.Popen([BINARY] + args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        for line in self.proc.stderr:
            line = line.strip()
            if line.startswith("{"):
                try:
                    p = json.loads(line)
                    if p.get("phase") == "checkpoint":
                        self.checkpoints += 1      # a progress save landed; the viewer reloads it
                    else:
                        self.phase, self.done, self.total, self.eta = p.get("phase"), p.get("done", 0), p.get("total", 0), p.get("eta")
                        self.at = p.get("at", self.at)
                except json.JSONDecodeError:
                    pass
            elif line:
                self.message = line
        out = self.proc.stdout.read()
        code = self.proc.wait()
        return code, out

    def run(self, video_path, segments, clock, targets, templates=(), start_at=None):
        os.makedirs(self.dir, exist_ok=True)
        seg_path = os.path.join(self.dir, "segments.json")
        try:
            if segments is not None:
                with open(seg_path, "w") as f:
                    json.dump(segments, f, indent=1)
            elif not os.path.exists(seg_path):
                self.state = "segments"
                code, out = self.run_step(["segments", video_path, seg_path, "--progress", "json"])
                if self.state == "cancelled":
                    return
                if code != 0:
                    self.state, self.message = "failed", (out or self.message)[-500:]
                    return
            self.state = "scanning"
            args = ["scan", video_path, self.dir, "--segments", seg_path, "--progress", "json"]
            if clock:
                args += ["--clock", clock]
            if targets:
                args += ["--targets", targets]
            registered = os.path.join(os.path.dirname(self.dir.rstrip(os.sep)), "..", "registered.txt")
            if os.path.exists(registered):
                args += ["--registered", os.path.normpath(registered)]
            for t in templates:
                args += ["--template", t]
            if start_at:
                args += ["--from", str(float(start_at))]
            code, out = self.run_step(args)
            if self.state == "cancelled":
                return
            self.summary = out.strip()
            self.state = "done" if code == 0 else "failed"
            if code != 0:
                self.message = (out or self.message)[-500:]
        except Exception as e:  # noqa: BLE001 — report anything to the viewer
            self.state, self.message = "failed", str(e)

    def cancel(self):
        # SIGTERM: the scanner saves everything read so far before exiting.
        self.state = "cancelled"
        if self.proc and self.proc.poll() is None:
            self.proc.terminate()


class Handler(SimpleHTTPRequestHandler):
    media = None

    # ---------- API ----------
    def _json(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _media_path(self, rel):
        full = os.path.normpath(os.path.join(self.media, rel))
        return full if full.startswith(self.media + os.sep) else None

    def _template_dir(self):
        d = os.path.join(self.media, "templates")
        os.makedirs(d, exist_ok=True)
        return d

    def _template_path(self, tid):
        """Template id = file name without .json; only plain names inside media/templates."""
        if not tid or not re.fullmatch(r"[A-Za-z0-9._ ()-]+", tid) or tid.startswith("."):
            return None
        return os.path.join(self._template_dir(), tid + ".json")

    def _templates(self):
        out = []
        for n in sorted(os.listdir(self._template_dir())):
            if not n.endswith(".json"):
                continue
            try:
                with open(os.path.join(self._template_dir(), n)) as f:
                    t = json.load(f)
            except (OSError, json.JSONDecodeError):
                continue
            tid = n[:-5]
            img = next((f"/media/templates/{tid}-design{e}" for e in (".png", ".jpg", ".jpeg", ".webp")
                        if os.path.exists(os.path.join(self._template_dir(), f"{tid}-design{e}"))), None)
            out.append({"id": tid, "name": t.get("name", tid), "hue": t.get("bandHue"), "calibrated": t.get("calibrated", 0),
                        "minBib": t.get("minBib") or 1, "maxBib": t.get("maxBib"), "image": img})
        return out

    def _bibwatch(self, args, timeout=120):
        r = subprocess.run([BINARY] + args, capture_output=True, text=True, timeout=timeout)
        return r.returncode, r.stdout, r.stderr

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/media":
            names = sorted(os.listdir(self.media))
            videos = [n for n in names if n.lower().endswith(VIDEO_EXT)]
            scans = {}
            scan_root = os.path.join(self.media, "scans")
            if os.path.isdir(scan_root):
                for d in sorted(os.listdir(scan_root)):
                    if d.startswith(".") or not os.path.isdir(os.path.join(scan_root, d)):
                        continue
                    det = os.path.join(scan_root, d, "detections.json")
                    seg = os.path.join(scan_root, d, "segments.json")
                    tg = os.path.join(scan_root, d, "tags.json")
                    scans[d] = {
                        "tags": f"/media/scans/{d}/tags.json" if os.path.exists(tg) else None,
                        "detections": f"/media/scans/{d}/detections.json" if os.path.exists(det) else None,
                        "segments": f"/media/scans/{d}/segments.json" if os.path.exists(seg) else None,
                        "updated": os.path.getmtime(det) if os.path.exists(det) else None,
                    }
            return self._json(200, {
                "videos": videos,
                "json": [n for n in names if n.lower().endswith(".json")],
                "scans": scans,
                "targets": os.path.exists(os.path.join(self.media, "targets.txt")),
                "scanner": os.path.exists(BINARY),
            })
        if path == "/api/scan":
            return self._json(200, JOB.status() if JOB else {"state": "idle"})
        if path == "/api/templates":
            return self._json(200, {"templates": self._templates()})
        if path == "/api/finder":
            # What the chosen templates find in one frame (for the viewer's "bib finder" overlay).
            from urllib.parse import parse_qs
            q = parse_qs(urlparse(self.path).query)
            video = self._media_path((q.get("video") or [""])[0])
            tids = [t for t in (q.get("templates") or [""])[0].split(",") if t]
            paths = [self._template_path(t) for t in tids]
            if not video or not os.path.isfile(video) or not paths or not all(p and os.path.exists(p) for p in paths):
                return self._json(400, {"error": "video or templates missing"})
            args = ["finder", video, "--at", (q.get("t") or ["0"])[0]]
            for p in paths:
                args += ["--template", p]
            code, out, err = self._bibwatch(args, timeout=30)
            if code != 0:
                return self._json(500, {"error": (err or out)[-300:]})
            return self._json(200, json.loads(out))
        return super().do_GET()

    def do_POST(self):
        global JOB
        path = urlparse(self.path).path
        length = int(self.headers.get("Content-Length") or 0)
        try:
            body = json.loads(self.rfile.read(length) or b"{}")
        except json.JSONDecodeError:
            return self._json(400, {"error": "invalid JSON"})
        if path == "/api/templates":
            # New template from bib artwork (image sent as base64 data URL) or from a bib in the video.
            name = (body.get("name") or "").strip() or "Bib"
            tid = re.sub(r"[^A-Za-z0-9._ ()-]+", "-", name).strip("-. ") or "bib"
            base, k = tid, 2
            while os.path.exists(self._template_path(tid)):
                tid, k = f"{base}-{k}", k + 1
            out_path = self._template_path(tid)
            extra = ["--name", name, "--max-bib", str(int(body.get("maxBib") or 250))]
            if body.get("minBib"):
                extra += ["--min-bib", str(int(body["minBib"]))]
            with TEMPLATE_LOCK:
                if body.get("image"):
                    m = re.match(r"data:image/(png|jpe?g|webp);base64,(.*)", body["image"], re.S)
                    if not m:
                        return self._json(400, {"error": "send a PNG, JPEG or WebP image"})
                    ext = ".jpg" if m.group(1).startswith("jp") else "." + m.group(1)
                    img_path = os.path.join(self._template_dir(), f"{tid}-design{ext}")
                    with open(img_path, "wb") as f:
                        f.write(base64.b64decode(m.group(2)))
                    code, out, err = self._bibwatch(["template", img_path, out_path] + extra)
                elif body.get("video") and body.get("at"):
                    video = self._media_path(body["video"])
                    if not video or not os.path.isfile(video):
                        return self._json(400, {"error": "video not in the media folder"})
                    t, x, y = body["at"]
                    code, out, err = self._bibwatch(["template", "--from-video", video, "--at", f"{t},{x},{y}", out_path] + extra)
                else:
                    return self._json(400, {"error": "send an image or a video point"})
            if code != 0 or not os.path.exists(out_path):
                return self._json(422, {"error": (err or out).strip()[-300:] or "could not make a template"})
            return self._json(200, {"id": tid, "message": out.strip(), "templates": self._templates()})
        if path == "/api/templates/calibrate":
            p = self._template_path(body.get("template"))
            video = self._media_path(body.get("video") or "")
            if not p or not os.path.exists(p) or not video or not os.path.isfile(video) or not body.get("at"):
                return self._json(400, {"error": "template, video and point needed"})
            t, x, y = body["at"]
            with TEMPLATE_LOCK:
                code, out, err = self._bibwatch(["calibrate", p, video, "--at", f"{t},{x},{y}"])
            if code != 0:
                return self._json(422, {"error": (err or out).strip()[-300:]})
            return self._json(200, {"message": out.strip(), "templates": self._templates()})
        if path == "/api/templates/delete":
            p = self._template_path(body.get("template"))
            if not p or not os.path.exists(p):
                return self._json(404, {"error": "no such template"})
            os.remove(p)
            return self._json(200, {"templates": self._templates()})
        if path == "/api/tags":
            # Your own tags on sightings (finisher, spectator, …), saved as you make them.
            video = body.get("video") or ""
            if not self._media_path(video) or not os.path.isfile(self._media_path(video)):
                return self._json(400, {"error": f"video not in the media folder: {video}"})
            tags = body.get("tags")
            if not isinstance(tags, dict):
                return self._json(400, {"error": "tags missing"})
            folder = os.path.join(self.media, "scans", os.path.splitext(video)[0])
            os.makedirs(folder, exist_ok=True)
            tmp = os.path.join(folder, ".tags.json.tmp")
            with open(tmp, "w") as f:
                json.dump(tags, f, indent=1)
            os.replace(tmp, os.path.join(folder, "tags.json"))
            return self._json(200, {"saved": True})
        if path == "/api/segments":
            # Mats and camera-segment edits from the viewer, saved as the user makes them.
            video = body.get("video") or ""
            if not self._media_path(video) or not os.path.isfile(self._media_path(video)):
                return self._json(400, {"error": f"video not in the media folder: {video}"})
            segs = body.get("segments")
            if not isinstance(segs, dict) or not isinstance(segs.get("segments"), list):
                return self._json(400, {"error": "segments missing"})
            folder = os.path.join(self.media, "scans", os.path.splitext(video)[0])
            os.makedirs(folder, exist_ok=True)
            tmp = os.path.join(folder, ".segments.json.tmp")
            with open(tmp, "w") as f:
                json.dump(segs, f, indent=1)
            os.replace(tmp, os.path.join(folder, "segments.json"))   # atomic: never half-written
            return self._json(200, {"saved": True, "at": time.time()})
        if path == "/api/scans/clear":
            # Delete this video's saved scan (frames read, crossings) — optionally keeping the
            # user's mats / camera-segment edits (segments.json). Only files bibwatch wrote.
            video = body.get("video") or ""
            if not self._media_path(video):
                return self._json(400, {"error": f"video not in the media folder: {video}"})
            if JOB and JOB.video == video and JOB.state in ("starting", "segments", "scanning"):
                return self._json(409, {"error": "a scan of this video is running — cancel it first"})
            folder = os.path.join(self.media, "scans", os.path.splitext(video)[0])
            names = ["detections.json", "crossings.csv", ".segments.json.tmp"]
            if not body.get("keepSegments", True):
                names.append("segments.json")
            removed = []
            for n in names:
                f = os.path.join(folder, n)
                if os.path.isfile(f):
                    os.remove(f)
                    removed.append(n)
            if os.path.isdir(folder) and not os.listdir(folder):
                os.rmdir(folder)
            return self._json(200, {"removed": removed})
        if path == "/api/scan/cancel":
            if JOB:
                JOB.cancel()
            return self._json(200, JOB.status() if JOB else {"state": "idle"})
        if path != "/api/scan":
            return self._json(404, {"error": "not found"})
        if not os.path.exists(BINARY):
            return self._json(500, {"error": "scanner not built — run: swift build -c release"})
        video = body.get("video") or ""
        video_path = self._media_path(video)
        if not video_path or not os.path.isfile(video_path):
            return self._json(400, {"error": f"video not in the media folder: {video}"})
        with JOB_LOCK:
            if JOB and JOB.state in ("starting", "segments", "scanning"):
                return self._json(409, {"error": f"a scan is already running ({JOB.video})", **JOB.status()})
            JOB = Job(video, self.media)
            targets = os.path.join(self.media, "targets.txt")
            tpaths = [self._template_path(t) for t in (body.get("templates") or [])]
            tpaths = [p for p in tpaths if p and os.path.exists(p)]
            threading.Thread(target=JOB.run, daemon=True, args=(
                video_path, body.get("segments"), body.get("clock"), targets if os.path.exists(targets) else None, tpaths,
                body.get("from"))).start()
        return self._json(202, JOB.status())

    # ---------- files ----------
    def translate_path(self, path):
        p = unquote(urlparse(path).path)
        if p.startswith("/media/"):
            # normpath (not realpath): blocks "../" but allows symlinks placed in the media folder
            return self._media_path(p[len("/media/"):]) or "/nonexistent"
        return os.path.join(ROOT, p.lstrip("/")) if p != "/" else os.path.join(ROOT, "index.html")

    def send_head(self):
        path = self.translate_path(self.path)
        if not os.path.isfile(path):
            self.send_error(404)
            return None
        size = os.path.getsize(path)
        ctype = mimetypes.guess_type(path)[0] or "application/octet-stream"
        rng = self.headers.get("Range")
        f = open(path, "rb")
        if rng:
            m = re.match(r"bytes=(\d*)-(\d*)", rng)
            start = int(m.group(1)) if m.group(1) else 0
            end = int(m.group(2)) if m.group(2) else size - 1
            end = min(end, size - 1)
            f.seek(start)
            self.send_response(206)
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
            self.send_header("Content-Length", str(end - start + 1))
            self._remaining = end - start + 1
        else:
            self.send_response(200)
            self.send_header("Content-Length", str(size))
            self._remaining = size
        self.send_header("Content-Type", ctype)
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        return f

    def copyfile(self, source, outputfile):
        remaining = getattr(self, "_remaining", None)
        while remaining is None or remaining > 0:
            chunk = source.read(min(1 << 20, remaining) if remaining is not None else 1 << 20)
            if not chunk:
                break
            try:
                outputfile.write(chunk)
            except (BrokenPipeError, ConnectionResetError):
                break
            if remaining is not None:
                remaining -= len(chunk)

    def log_message(self, fmt, *args):
        pass


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--media", required=True, help="folder with the video(s); scans are saved under <media>/scans/")
    ap.add_argument("--port", type=int, default=8765)
    a = ap.parse_args()
    Handler.media = os.path.abspath(a.media)
    print(f"viewer: http://127.0.0.1:{a.port}/   media: {Handler.media}")
    if not os.path.exists(BINARY):
        print("note: scanner not built yet — run `swift build -c release` to enable the Run scan button")
    ThreadingHTTPServer(("127.0.0.1", a.port), Handler).serve_forever()
