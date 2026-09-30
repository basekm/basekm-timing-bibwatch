# Agent Skills — bibwatch web (viewer)

Skills available in this app, under `.agents/skills/` (symlinked into `.claude/skills/`). They are copied from `basekm-timing-engine-web` so both apps share one structure and theme. Read the relevant one before writing or modifying code here.

| Skill | When to use |
|---|---|
| [basekm-architecture](./basekm-architecture/SKILL.md) | Creating a new feature, file, component, screen, API call, DTO, constant, or hook, or deciding where code belongs. Includes the `code-style.md` sub-skill (comments, equality, braces, naming). |
| [shadcn](./shadcn/SKILL.md) | Adding or changing a `components/ui/` primitive. Copy primitives from `basekm-timing-engine-web` first so both apps stay identical. |

## Where the viewer lives

- `app/page.tsx` renders `screens/ViewerPageScreen` (one page, built as static files).
- `screens/ViewerPageScreen/` owns the page: `hooks/useViewerSession.ts` (video, scan results, finish lines, tags, autosave), `utils/VideoPlaybackController.ts` (scrubbing and trackpad swipes), `utils/drawVideoOverlay.ts` (boxes on the video).
- `src/@shared/api/*` talks to the bibwatch server (`server/`, NestJS) under `/api`; `src/@shared/utils/decideSightings.ts` mirrors the sighting decisions in `Sources/bibwatch/Scan.swift` (keep them identical: `bench/run.sh` checks).
- `components/ViewerHeader/` follows `DashboardHeader` in `basekm-timing-engine-web`.
