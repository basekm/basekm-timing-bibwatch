# Screens Deep Dive

Screens are full page-level components that live under `src/screens/`. They are the primary owners of page state, data fetching, and layout composition.

---

## Folder Structure

```
src/screens/<PageName>Screen/
  <PageName>Screen.tsx
  index.ts
```

The `index.ts` is a barrel export:
```ts
export { CheckoutPageScreen } from './CheckoutPageScreen';
```

---

## Rules

- **One screen per page/route.**
- Screens are **not reused** across multiple pages. If logic is shared, extract it into `src/components/` or `src/hooks/`.
- Screens **own data fetching**. They call `*Queries` and `*Mutations` hooks and pass data down to components as props.
- Screens manage **page-level state** (modals open/closed, selected items, form state, etc.).
- Mark as `'use client'` when the screen requires interactivity or hooks.

---

## Relationship with `src/app/`

The `src/app/` page file is a **thin wrapper** that:
1. Handles SSR prefetching via `HydrationBoundary` + `dehydrate` (if needed).
2. Renders exactly one `*Screen` component.

**Always use `const Index` + `export default Index`, never `export default function`.**

```tsx
// src/app/register/page.tsx  ← thin
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { getQueryClient } from '@basekm/lib/queryClient';
import { RaceCategoryPrefetchQueries } from '@basekm/api';
import { RegistrationPageScreen } from '@basekm/screens/RegistrationPageScreen';

const Index = async () => {
  const queryClient = getQueryClient();
  await RaceCategoryPrefetchQueries.prefetchAll();

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <RegistrationPageScreen />
    </HydrationBoundary>
  );
};

export default Index;
```

```tsx
// src/screens/RegistrationPageScreen/RegistrationPageScreen.tsx  ← owns logic
'use client';

export const RegistrationPageScreen = () => {
  const { raceCategoryGetAllQuery } = RaceCategoryQueries.useGetAll();
  // ... state, handlers, layout
};
```

---

## Layout files (`layout.tsx`)

Layouts in `src/app/` are **not** backed by a `*LayoutScreen` file. Write layout logic directly in the `layout.tsx` file.

**Always use `const Layout` + `export default Layout`, never `export default function`.**

```tsx
// src/app/(dashboard)/layout.tsx
const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div>
      {/* layout chrome */}
      {children}
    </div>
  );
};

export default Layout;
```

---

## Naming

Always suffix with `Screen`:

- `RegistrationPageScreen`
- `CheckoutPageScreen`
- `CheckoutSuccessPageScreen`
- `ErrorCheckoutPageScreen`
