# Constants Deep Dive

App-wide constants live under `src/@shared/constants/`.

---

## Folder Structure

```
src/@shared/constants/
  index.ts
  Animation.ts
  BloodType.ts
  CheckoutSessionLineItemTypeId.ts
  Gender.ts
  ProductAssignmentMode.ts
  Relationship.ts
  Routes.ts
  StaticSettings.ts
```

Each file is dedicated to a single concern. Export from `src/@shared/constants/index.ts`.

---

## What Goes Here

- **Enums or union types** for domain values: `Gender`, `BloodType`, `Relationship`
- **ID/type registries**: `CheckoutSessionLineItemTypeId`, `ProductAssignmentMode`
- **App configuration values**: `StaticSettings` (e.g. max retries, pagination size)
- **Animation config**: `Animation` (shared Framer Motion variants/durations)
- **Route definitions**: `Routes`

---

## `Routes.ts`, Typed Route Definitions

Routes use a `RouteInstance` class pattern that provides type-safe dynamic URL param injection.

```ts
export const Routes = {
  // Static route, access via .url
  Home: new RouteInstance('https://basekm.com'),

  // Dynamic route, access via .dynamicUrl(params, query?)
  Checkout: new RouteInstance('register/[registrationId]/checkout', {
    dynamic: true,
  }),
};

// Static usage
Routes.Home.url; // → 'https://basekm.com'

// Dynamic usage, TypeScript enforces all params are provided
Routes.Checkout.dynamicUrl({ registrationId: '123' }); // → 'register/123/checkout'

// With optional query string
Routes.Checkout.dynamicUrl({ registrationId: '123' }, { ref: 'email' }); // → 'register/123/checkout?ref=email'
```

Always define new routes in `Routes.ts`, never hardcode path strings in components or screens.

---

## Naming Conventions

| Type | Convention | Example |
|---|---|---|
| Enum-like object | PascalCase object with string/number values | `export const Gender = { Male: 'male', Female: 'female' }` |
| TypeScript enum | PascalCase | `export enum BloodType { APositive = 'A+', ... }` |
| Config object | PascalCase | `export const StaticSettings = { MaxPromoCodeLength: 20 }` |

---

## What Does NOT Go Here

- Component-specific display labels → keep those inline in the component, still named in PascalCase (`RaceFormatLabels`, not `RACE_FORMAT_LABELS`) — this codebase does not use SCREAMING_SNAKE_CASE for any constant, local or shared.
- API URLs → those belong in `*Api.ts` using `Environment.ApiBaseUrl`.
- Feature flags or environment-specific values → use `src/@shared/envs/Environment.ts`.
