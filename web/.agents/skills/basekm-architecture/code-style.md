# Code Style Deep Dive

General TypeScript/React conventions that apply across every layer (components, screens, API, etc.), on top of each layer's own structural rules.

---

## No Comments, Ever — Write Code That Doesn't Need Them

Never add comments. Not a "what it does" comment, not a "why" comment about backend gaps, TODOs, edge cases, or design rationale. None.

The goal isn't "fewer comments" — it's code simple and self-explanatory enough that a comment was never a candidate in the first place:

- Name things for what they mean, not what they hold (`flagLapNumber`, not `n` or `temp`).
- Keep functions small and flow linear — one thing per function, early returns over nested conditionals, a named intermediate variable over a clever one-liner that needs unpacking.
- If a line feels like it needs a comment to be understood, that's a signal to rewrite the line (extract a variable, rename something, split the function), not a signal to add the comment.

If a reviewer genuinely needs the "why" (a backend limitation, a design tradeoff, a non-obvious constraint), that belongs in the PR description, not the source file.

```ts
// Avoid
// Backend doesn't send this field yet -- kept as an optional overlay
// so the UI stays dormant until it does.
type ResultRowWithLaps = RaceParticipantResultGetResponseDto & {
  lapsCompleted?: number | null;
};

// Prefer
type ResultRowWithLaps = RaceParticipantResultGetResponseDto & {
  lapsCompleted?: number | null;
};
```

---

## Strict Equality Always

Never use `==`/`!=`. Always use `===`/`!==`, including for null/undefined checks — check both explicitly rather than relying on `== null`'s dual-match behavior.

```ts
// Avoid
if (value == null) return null;

// Prefer
if (value === null || value === undefined) {
  return null;
}
```

---

## Always Use Curly Braces

Every `if`/`else`/`for`/`while` body gets braces, even single-statement ones. No exceptions for one-liners.

```ts
// Avoid
if (condition) return 'foo';

// Prefer
if (condition) {
  return 'foo';
}
```

---

## Named Variables Over Inline Ternary Chains

When a render value depends on more than one condition, extract each branch into a named variable before combining them, rather than nesting ternaries inline in JSX.

```ts
// Avoid
{totalLaps != null ? `${lapsCompleted} / ${totalLaps}` : `${lapsCompleted} loops`}

// Prefer
const lapsProgressTextDisplay = `${lapsCompleted} / ${totalLaps}`;
const lapsCompletedTextDisplay = `${lapsCompleted} loops`;
const textDisplay = (totalLaps && lapsProgressTextDisplay) || lapsCompletedTextDisplay;
```

---

## Derive Values Into Named Variables, Not Inline in JSX Props

Lookups and derivations (`.find()`, `.filter()`, `.map()`, `??` fallbacks) go into a named variable above the `return`, and the JSX prop receives that variable. Don't compute them inline in a prop.

```tsx
// Avoid
<ParticipantTimingSummary
  category={categories.find((category) => category.id === participant.categoryId) ?? null}
/>

// Prefer
const participantCategory = categories.find((category) => category.id === participant?.categoryId) ?? null;

<ParticipantTimingSummary
  category={participantCategory}
/>
```

---

## Cast Once, at the Declaration

When a value needs a type cast (e.g. an optional-field overlay ahead of a generated DTO catching up), cast it once where the variable is declared, not inline at each usage site.

```ts
// Avoid
{(results as ResultRowWithLaps[]).map((item) => ...)}

// Prefer
const resultsWithLaps = results as ResultRowWithLaps[];
{resultsWithLaps.map((item) => ...)}
```

---

## No Arbitrary Tailwind Values

Don't reach for an arbitrary bracket value (`text-[11px]`, `text-[10px]`) when a standard utility already covers it. Use the scale (`text-xs`, `text-sm`, ...) unless the design genuinely calls for a one-off value no scale step provides.

```tsx
// Avoid
<span className="text-[11px] font-bold uppercase">

// Prefer
<span className="text-xs font-bold uppercase">
```

---

## Enum-Like Values: Const Object, Not a Bare Union

When a value has a small fixed set of options used both as a type and as values you compare/assign (a "race format", a "role", a "status"), define it as a `const` object with `as const`, then derive the type from it — mirrors this repo's existing `Gender`/`BloodType`/`RaceCapturePointRole` pattern. Don't use a bare string-literal union type with raw string literals scattered through the call sites; the const object gives you one place to change values and autocomplete-friendly reuse (`RaceFormat.FixedLaps` instead of `'fixedLaps'`).

```ts
// Avoid
export type RaceFormat = 'standard' | 'fixedLaps' | 'timedLoop';
// ...later: if (raceFormat === 'fixedLaps') { ... }

// Prefer
export const RaceFormat = {
  Standard: 'standard',
  FixedLaps: 'fixedLaps',
  TimedLoop: 'timedLoop',
} as const;
export type RaceFormat = (typeof RaceFormat)[keyof typeof RaceFormat];
// ...later: if (raceFormat === RaceFormat.FixedLaps) { ... }
```

---

## Multi-Parameter Functions Take a Single Object

Once a plain function (not a React component — see `components.md` for those) takes more than one parameter, collapse them into a single destructured object param instead of a positional list. Define the param shape as its own named type. This applies to helpers in `lib/`, transformer methods, and any other multi-arg utility.

```ts
// Avoid
export const formatCapturePointLabel = (
  role: string | null,
  name: string,
  lapNumber: number,
  variant?: 'chip' | 'gun',
): string => { ... };
formatCapturePointLabel(cp.role, cp.name, cp.lapNumber, variant);

// Prefer
type FormatCapturePointLabelParams = {
  role: string | null;
  name: string;
  lapNumber: number;
  variant?: 'chip' | 'gun';
};

export const formatCapturePointLabel = ({
  role,
  name,
  lapNumber,
  variant,
}: FormatCapturePointLabelParams): string => { ... };

formatCapturePointLabel({
  role: cp.role,
  name: cp.name,
  lapNumber: cp.lapNumber,
  variant,
});
```

A single-parameter function doesn't need this — only reach for the object shape once there's more than one argument.

---

## No Magic / Implicit Inference

Don't infer a business rule from unrelated data instead of reading it explicitly off the API response — especially when the inferred value then gets rendered as if it were real server data. An inferred rule silently breaks the moment the actual invariant changes, and it's invisible to anyone reading the component without also knowing the backend's derivation logic.

If a business rule needs deriving, that belongs in the API contract (the backend adds an explicit field or value), not reconstructed on the frontend from a loosely-related signal.

```ts
// Avoid — inferring "this capture point tracks laps" from an unrelated role
const tracksLaps = capturePoint.roles.includes('finish');

// Prefer — reading it directly off the field that actually says so
const tracksLaps = capturePoint.roles.includes('lap');
```

---

## Prefer Extending an Existing Transformer Over a Local Inline Helper

Before writing a small local formatting/derivation function inside a component, check whether the logic belongs on an existing transformer (`src/@shared/transformers/`) as a new getter or method instead. A component-local helper that wraps a transformer call in a null check is a sign the transformer itself is missing that case, not a sign the component needs its own function.

```ts
// Avoid -- a local helper wrapping a transformer call
const formatEventTime = (capturedAt: string | null): string =>
  capturedAt ? DateTransformer.from(capturedAt).toClockTime : '-';
// ...later
formatEventTime(evt.capturedAt);

// Prefer -- the fallback lives on the transformer, call sites stay inline
DateTransformer.from(evt.capturedAt).toClockTimeOr('-');
```

This also applies to small pure derivations with no natural transformer home (e.g. a `role -> 'asc' | 'desc'` mapping): if the same one-liner is about to exist in a second file, that is the signal to move it to `src/@shared/utils/` instead of writing a second copy.

---

## Extract Shared Types/Constants Out of a Form or Screen

When a screen or form component accumulates more than one or two standalone types/constants that aren't tied to its render logic (a union type, a label map, a small derivation helper), move them into a colocated `<Feature>Types.ts` file next to the component, rather than leaving them at the top of the component file.

```
screens/DashboardRaceCategoriesPageScreen/components/
  EditCategoryForm.tsx
  RaceFormatTypes.ts   # RaceFormat, RaceFormatLabels, deriveRaceFormat
```

---

## Constants Are PascalCase, Not SCREAMING_SNAKE_CASE

Name module-level constants in PascalCase, the same as the const-object enums above. Don't use `SCREAMING_SNAKE_CASE`, even for plain numbers or strings.

```ts
// Avoid
export const FINAL_MINUTE_MS = 60_000;
export const TIMED_LAPS_FINISH_MODE: RaceCategoryFinishMode = 'timedLaps';
const ALL_GENDERS_VALUE = 'all';

// Prefer
export const FinalMinuteMs = 60_000;
export const TimedLapsFinishMode: RaceCategoryFinishMode = 'timedLaps';
const AllGendersValue = 'all';
```

---

## Reuse Shared Domain Constants Instead of Redeclaring Them

Domain values that more than one screen needs (e.g. `Gender`, its labels, a type guard) live in `src/@shared/constants/` (see `constants.md`). Import them from `@basekm/@shared/constants` rather than declaring another local `GENDER_LABELS`-style map in a screen.

```ts
// Avoid -- a fresh copy in every screen
const GENDER_LABELS: Record<string, string> = { male: 'M', female: 'F' };

// Prefer
import { GenderShortLabels, isGender } from '@basekm/@shared/constants';
```
