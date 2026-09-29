# Envs & Type-Utils Deep Dive

---

## `src/@shared/envs/`, Environment Variables

### Rule: Never Access `process.env` Directly

All environment variable access must go through `Environment.ts`. This centralizes the config and makes it easy to audit what env vars the app depends on.

```ts
// ✅ Correct
import { Environment } from '@basekm/envs';
const url = Environment.ApiBaseUrl;

// ❌ Wrong, do not do this in feature code
const url = process.env.NEXT_PUBLIC_API_BASE_URL;
```

### Adding a New Environment Variable

1. Add it to `.env.local` (and `.env.example` if one exists).
2. Expose it in `src/@shared/envs/Environment.ts`:

```ts
export class Environment {
  static get ApiBaseUrl() {
    return process.env.NEXT_PUBLIC_API_BASE_URL!;
  }

  // Add new var here:
  static get MyNewVar() {
    return process.env.NEXT_PUBLIC_MY_NEW_VAR!;
  }
}
```

3. Import via `@basekm/envs` or `@basekm/@shared/envs`.

### Naming

- Client-side vars (accessible in browser): prefix with `NEXT_PUBLIC_`.
- Server-only vars: no prefix. Only access in server components, API routes, or `*PrefetchQueries.ts`.

---

## `src/@shared/type-utils/`, TypeScript Utility Types

Small, focused utility types with no runtime code.

### `PayloadOnly<T>`

Strips all method/function properties from a class, leaving only data properties. Use this whenever a DTO class is passed as a plain object argument.

```ts
export type PayloadOnly<T> = Pick<T, {
  [K in keyof T]: T[K] extends Function ? never : K
}[keyof T]>;
```

**Usage:**
```ts
// API method accepts plain data, not a class instance
static async getSession(data: PayloadOnly<CheckoutSessionGetRequestDto>) { ... }
```

### Adding New Utility Types

- Add a new file per type: `src/@shared/type-utils/<TypeName>.type.ts`
- Re-export from `src/@shared/type-utils/index.ts`
- Import via `@basekm/type-utils`
