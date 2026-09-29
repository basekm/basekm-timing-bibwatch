# Hooks Deep Dive

Custom React hooks live under `src/hooks/`.

---

## What Goes Here

Hooks that are:
- **Reusable across multiple screens or components** (not tied to a single screen).
- **UI/UX concerns**, not domain data fetching (those live in `src/@shared/api/*Queries.ts`).

**Examples:**
- `use-mobile.ts`, detects viewport breakpoints
- A `useDebounce` hook, a `useLocalStorage` hook, etc.

---

## What Does NOT Go Here

| Concern | Where it actually belongs |
|---|---|
| Fetching API data | `src/@shared/api/<domain>/<Domain>Queries.ts` |
| Mutating API data | `src/@shared/api/<domain>/<Domain>Mutations.ts` |
| Screen-specific state logic | Inline in the screen component |

---

## Naming Convention

- File: `use-<name>.ts` (kebab-case)
- Export: `use<Name>` (camelCase)

```ts
// src/hooks/use-mobile.ts
export function useIsMobile(): boolean { ... }
```

---

## Structure

Hooks are single files (no subfolder needed unless the hook has associated types/utils):

```
src/hooks/
  use-mobile.ts
  use-debounce.ts
```
