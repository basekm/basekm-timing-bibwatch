# Components Deep Dive

Reusable UI components live under `src/components/`.

---

## Folder Structure

Every component gets its **own folder**:

```
src/components/<ComponentName>/
  <ComponentName>.tsx
  index.ts
```

The `index.ts` is a barrel export:
```ts
export { ComponentName } from './ComponentName';
```

---

## Rules

- **One component per folder.** Do not bundle multiple unrelated components together.
- **PascalCase** for both the folder name and the component name.
- Components are **reusable across multiple screens**. If something is only used in one screen, consider co-locating it in the screen file instead.
- Components should be **presentational or lightly stateful**. They should not directly call API query/mutation hooks unless the interaction is fully self-contained within that component (e.g., a promo code input that manages its own submit).
- Accept data as **props**, let the parent screen own the data fetching.

## Formatting Rules

- **Component Props**: Format component props such that each prop is explicitly moved to its own new line, regardless of the number of props.
- **Function Declarations**: Use arrow functions (`export const ComponentName = () => {}`) for defining React components.
- **Arrow Function Parameters**: Always enclose single parameters in arrow functions with parentheses (e.g., `(param) => {}`).
- **Imports**: Format imports such that each imported member is on its own line, even if there is only a single member.
- **Explicit Naming**: Use highly descriptive and explicit variable names (e.g., `channelSubscription` instead of `sub`).
- **Vertical Whitespace**: Generously use blank lines to separate logical blocks within functions.
- **Text Sizing**: Use the design system's semantic Tailwind size classes (`text-xs`, `text-sm`, ...) rather than arbitrary pixel values (`text-[10px]`, `text-[11px]`, `text-[10.5px]`, etc.). If a semantic size doesn't quite match a design, that's a signal to revisit the design rather than reach for an arbitrary value.
- **Early Returns**: Wrap every branch of a multi-condition `if` chain in braces with a blank line between branches — never a single-line `if (cond) return x;` chained together, and avoid nested ternaries past one level. See `transformers.md`'s "Code Style: Early Returns" for a worked example.

---

## Card Container Sizing Scale

Card-style containers (an edit form, a read-only summary panel, etc.) that sit inside a screen use one consistent sizing scale rather than each picking its own padding/gaps/text sizes. When adding a new card or auditing an existing one, match these tokens:

| Token | Value |
|---|---|
| Card padding | `p-6` |
| Card outer `flex flex-col` gap | `gap-6` |
| Card max-width | `max-w-3xl` |
| Field/data grid gap (`grid grid-cols-2 gap-*`) | `gap-6` |
| Label-to-field/value gap | `gap-1.5` |
| Field label / section header text | `text-xs` |
| Emphasized value text (an input's typed text, a headline metric) | `text-sm` or `text-base` for the single most prominent metric on the card |
| Inputs and Selects | design-system default size (`h-9`, no `size="sm"` override) |

Two sibling cards on the same screen (e.g. an edit form directly above a read-only summary) must use identical values for padding/gap/max-width — a size mismatch between adjacent cards reads as a bug even when each card is internally fine. See `ParticipantEditForm` and `ParticipantTimingSummary` in `DashboardParticipantDetailScreen.tsx` for a matched pair built to this scale.

This scale is separate from but consistent with the "Text Sizing" rule below — always the semantic Tailwind classes (`text-xs`, `text-sm`, `text-base`), never an arbitrary bracket value.

---

## `src/components/ui/`, shadcn/ui Primitives

- Reserved exclusively for **shadcn/ui** generated components (Button, Input, Dialog, Card, etc.).
- Do **not** place custom business components here.
- Do **not** modify shadcn components directly, wrap them in a custom component under `src/components/` instead.

---

## Naming Conventions

Name components after what they **display**, not what they do:

| Good | Avoid |
|---|---|
| `CheckoutSummaryLineItems` | `LineItemsList` |
| `RaceDetailsBannerSection` | `Banner` |
| `SelectBloodType` | `BloodTypeDropdown` |
| `SkeletonCheckoutSummaryTotal` | `LoadingSkeleton` |

Skeleton/loading variants are prefixed with `Skeleton`: `SkeletonCheckoutSummaryLineItems`.

---

## Example Component

```tsx
// src/components/CheckoutSummaryTotal/CheckoutSummaryTotal.tsx

export type CheckoutSummaryTotalProps = {
  total: number;
  currency: string;
};

export const CheckoutSummaryTotal = ({ 
  total, 
  currency 
}: CheckoutSummaryTotalProps) => {

  return (
    <div>
      <span>{currency}</span>
      <span>{total}</span>
    </div>
  );
};
```
