# DTOs Deep Dive

Data Transfer Objects live under `src/@shared/dtos/` and model the shape of API request payloads and response bodies.

---

## Key Rule: Do Not Edit Manually

DTOs are **auto-synced from the backend**. Run the sync script to regenerate:

```bash
npm run sync:dtos:types
```

The header of each generated file will say:
```ts
// Auto-generated types from backend DTOs - DO NOT EDIT MANUALLY
// Run: npm run sync:dtos:types
```

Only add DTOs manually if they are frontend-only (no backend counterpart).

---

## Folder Structure

DTOs are organized by domain, mirroring the API folder structure:

```
src/@shared/dtos/
  AppBaseDto.ts
  ArrayBaseDto.ts
  PaginationBaseRequestDto.ts
  index.ts
  checkout/
    CheckoutSessionCreateRequestDto.ts
    CheckoutSessionGetRequestDto.ts
    CheckoutSessionGetResponseDto.ts
    ...
  products/
  registrations/
  ...
```

---

## Naming Convention

```
<Domain><Action><Direction>Dto.ts
```

| Part | Values |
|---|---|
| Domain | `Checkout`, `Product`, `Registration`, `RaceCategory`, ... |
| Action | `Create`, `Get`, `Update`, `Delete`, `Add`, `Remove`, ... |
| Direction | `Request`, `Response` |

**Examples:**
- `CheckoutSessionCreateRequestDto`
- `CheckoutSessionGetResponseDto`
- `CheckoutSessionGetLineItemsResponseDto`
- `RegistrationGetRequestDto`

---

## Usage with `PayloadOnly<T>`

DTOs are classes. When passing a DTO as a plain object (e.g., as an API call argument), use `PayloadOnly<T>` to strip methods and keep only data properties:

```ts
import { PayloadOnly } from '@basekm/type-utils';
import { CheckoutSessionGetRequestDto } from '@basekm/dtos';

// In *Api.ts method signature:
static async getSession(data: PayloadOnly<CheckoutSessionGetRequestDto>) { ... }

// In *Queries.ts hook signature:
useGetSession: (data: PayloadOnly<CheckoutSessionGetRequestDto>) => { ... }
```

---

## Barrel Export

`src/@shared/dtos/index.ts` re-exports all DTOs. Import from `@basekm/dtos` or `@basekm/@shared/dtos`.
