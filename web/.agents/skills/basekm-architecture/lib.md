# Lib Deep Dive

Third-party library configuration lives under `src/lib/`.

---

## What Goes Here

Setup, configuration, and thin wrappers for external libraries. Not business logic.

---

## Existing Files

### `queryClient.ts`, TanStack Query Client

Implements the SSR-safe singleton pattern recommended for Next.js App Router:
- Server: a new `QueryClient` is created per request.
- Browser: a single `QueryClient` is reused across navigations.

```ts
export function getQueryClient(): QueryClient { ... }
```

Always use `getQueryClient()`, never instantiate `QueryClient` directly in feature code.

### `utils.ts`, Tailwind Class Merging

Exports the `cn()` helper used throughout components to merge Tailwind classes:

```ts
import { cn } from '@basekm/lib/utils';

<div className={cn('base-class', condition && 'conditional-class')} />
```

### `payrex-js/`, Payrex Payment SDK

Wrapper around the Payrex payment SDK. Use the exports from here rather than importing the SDK directly.

---

## Adding a New Library Config

1. Create a new file in `src/lib/` named after the library: `src/lib/analytics.ts`.
2. Export only what the rest of the app needs, keep the surface area small.
3. Import in feature code via `@basekm/lib/<filename>`.

Do **not** put business logic in `src/lib/`. It is strictly for setup and configuration.
