# Transformers Deep Dive

Transformers live under `src/@shared/transformers/` and are responsible for reshaping raw API response data into a form that's easier to consume in the UI.

---

## When to Use a Transformer

Use a transformer when:
- Raw API data needs structural reshaping before it can be rendered (e.g., flattening nested arrays, grouping variants by type).
- The same transformation is needed in multiple places.
- The transformation logic is complex enough that it shouldn't live inline in a component or screen.

Do **not** use a transformer for simple property access or trivial formatting, do that inline.

**Date/time formatting is the one exception that always gets a transformer**, even though it looks "trivial": use `DateTransformer` (`src/@shared/transformers/DateTransformer.ts`) rather than a one-off `formatX` helper in `src/lib/`. Add a new getter to it (e.g. `toPrettyDate`, `toClockTime`) rather than creating a parallel `lib/format-*.ts` file — check `DateTransformer` first before writing any new date/time formatting logic.

---

## Pattern: Static Factory Class

Transformers are **classes** with a private value and one or more **static factory methods**:

```ts
export class ProductImageTransformer {
  private value: string;

  constructor(value: string) {
    this.value = value;
  }

  // Static factory, preferred entry point
  static from(value: string) {
    return new ProductImageTransformer(value);
  }

  // Instance methods that return the transformed value
  toUrl(): string {
    return `${Environment.CdnBaseUrl}/${this.value}`;
  }
}
```

For array variants, create a companion class:

```ts
class ProductImagesTransformer {
  private value: { filename: string; type: string }[];

  constructor(value: ProductImagesTransformer['value']) {
    this.value = value;
  }

  static from(value: ProductImagesTransformer['value']) {
    return new ProductImagesTransformer(value);
  }

  toUrls(): string[] {
    return this.value.map((img) => ProductImageTransformer.from(img.filename).toUrl());
  }
}

// Then expose fromArray on the primary transformer:
export class ProductImageTransformer {
  static fromArray(value: Parameters<typeof ProductImagesTransformer.from>[0]) {
    return ProductImagesTransformer.from(value);
  }
}
```

---

## Naming Convention

- `<Entity>Transformer` for single-item transformers.
- The companion array class is named `<Entity>sTransformer` (plural) and kept in the same file.

**Real example in this codebase:** `RaceCaptureEventTransformer` (`src/@shared/transformers/RaceCaptureEventTransformer.ts`) wraps a `RaceCaptureEventGetResponseDto` + the race's participant list, `.from(event, participants).toPassing()` reshapes them into the flat `TransformedRawPassing` shape the Live Timing feed renders.

`DateTransformer` (`src/@shared/transformers/DateTransformer.ts`) is a plain formatting example: `DateTransformer.from(value).toPrettyDate` and `.toClockTime`. When an instance method takes no arguments and just derives a display value, expose it as a **getter** (`get toPrettyDate(): string`), called without parens — this reads more naturally than `.toPrettyDate()` for a pure derived value.

---

## Code Style: Early Returns

Multi-branch methods/getters use an early-return `if` chain, never a nested ternary past one level. Each branch gets its own braces and a blank line separates successive branches — never a single-line `if (cond) return x;`:

```ts
// Good
get toClockTime(): string {
  const date = this.toDate();
  if (!date) {
    return '';
  }

  return date.toLocaleTimeString(/* ... */);
}

// Avoid
get toClockTime(): string {
  if (!this.value) return '';
  const date = ...
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(/* ... */);
}
```

This applies wherever similar branching shows up (services, transformers, utils) — not just here.

---

## Folder Structure

```
src/@shared/transformers/
  index.ts
  RaceCaptureEventTransformer.ts
```

Barrel export via `src/@shared/transformers/index.ts`.
