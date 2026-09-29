---
name: basekm-architecture
description: Architectural conventions for the basekm web projects, where to place components, screens, APIs, DTOs, constants, transformers, hooks, and other building blocks. Use this skill when creating new features, files, or when deciding where code belongs.
---

# basekm Architecture Guide

This is the **index skill**. It gives a high-level overview and decision guide, then points to focused sub-skill files for deep detail on each layer.

**When the user's task involves a specific layer, read the corresponding sub-skill file before proceeding:**

| Layer | When to read | Sub-skill file |
|---|---|---|
| API (queries, mutations, fetch) | Creating/editing `*Api.ts`, `*Queries.ts`, `*Mutations.ts`, `*PrefetchQueries.ts` | `./api.md` |
| Components | Creating/editing a reusable UI component | `./components.md` |
| Screens | Creating/editing a page-level screen | `./screens.md` |
| DTOs | Creating/editing request or response types | `./dtos.md` |
| Transformers | Creating/editing data transformation classes | `./transformers.md` |
| Constants | Creating/editing app-wide constants or enums | `./constants.md` |
| Envs / Type-utils | Adding env vars or TypeScript utility types | `./envs.md` |
| Hooks | Creating/editing a custom React hook | `./hooks.md` |
| Lib | Configuring a third-party library | `./lib.md` |
| Code style | Writing any TypeScript/React code (comments, equality, braces, naming) | `./code-style.md` |

---

This skill defines the structural conventions for basekm Next.js web projects (e.g., `basekm-timing-engine-web`).

---

## Top-Level `src/` Structure

```
src/
  @shared/       # Domain logic shared across the app (API, DTOs, constants, utils, etc.)
  app/           # Next.js App Router, thin route entry points only
  components/    # Reusable UI components
  hooks/         # Custom React hooks
  lib/           # Third-party library configuration
  screens/       # Full page-level UI components
```

`src/app/` pages are **thin**. They only handle SSR wiring (`HydrationBoundary`, `dehydrate`) and render a single `*Screen` component. All UI and logic lives in `screens/` or `components/`.

---

## Import Aliases

| Alias | Resolves to |
|---|---|
| `@basekm/@shared/...` | `src/@shared/...` |
| `@basekm/api` | `src/@shared/api` |
| `@basekm/dtos` | `src/@shared/dtos` |
| `@basekm/envs` | `src/@shared/envs` |
| `@basekm/type-utils` | `src/@shared/type-utils` |
| `@basekm/screens/...` | `src/screens/...` |
| `@basekm/components/...` | `src/components/...` |
| `@basekm/lib/...` | `src/lib/...` |

---

## Decision Guide: Where Does New Code Go?

| What you're creating | Where it goes | Read sub-skill |
|---|---|---|
| New page/route | `src/app/<route>/page.tsx` + `src/screens/<Name>PageScreen/` | `./screens.md` |
| Reusable UI component | `src/components/<ComponentName>/` | `./components.md` |
| shadcn/ui primitive | `src/components/ui/` | `./components.md` |
| HTTP call to backend | `src/@shared/api/<domain>/<Domain>Api.ts` | `./api.md` |
| React Query hook (read) | `src/@shared/api/<domain>/<Domain>Queries.ts` | `./api.md` |
| React Query hook (write) | `src/@shared/api/<domain>/<Domain>Mutations.ts` | `./api.md` |
| SSR prefetch | `src/@shared/api/<domain>/<Domain>PrefetchQueries.ts` | `./api.md` |
| Request/response type | `src/@shared/dtos/<domain>/` | `./dtos.md` |
| App-wide constant/enum | `src/@shared/constants/` | `./constants.md` |
| Data reshaping logic | `src/@shared/transformers/` | `./transformers.md` |
| Environment variable | `src/@shared/envs/Environment.ts` | `./envs.md` |
| TypeScript utility type | `src/@shared/type-utils/` | `./envs.md` |
| Pure utility function | `src/@shared/utils/` | None |
| Reusable React hook | `src/hooks/` | `./hooks.md` |
| Library config/setup | `src/lib/` | `./lib.md` |
