# API Layer Deep Dive

All API code lives under `src/@shared/api/`. Each domain gets its own subfolder.

---

## Domain Folder Structure

```
src/@shared/api/<domain>/
  <Domain>Api.ts
  <Domain>Queries.ts
  <Domain>Mutations.ts         # only if domain has write operations
  <Domain>PrefetchQueries.ts   # only if domain needs SSR prefetching
```

**Example:**
```
src/@shared/api/checkout/
  CheckoutApi.ts
  CheckoutQueries.ts
  CheckoutMutations.ts
  CheckoutPrefetchQueries.ts
```

---

## `*Api.ts`, Raw HTTP Client

- A **static class** that extends `BaseApi`.
- One method per endpoint. No React, no hooks.
- Accepts `PayloadOnly<SomeRequestDto>` as its argument type.
- Returns the raw parsed JSON response (type the return with the matching `*ResponseDto`).

```ts
export class CheckoutApi extends BaseApi {
  private static baseUrl = `${Environment.ApiBaseUrl}/checkout`;

  static async getSession(data: PayloadOnly<CheckoutSessionGetRequestDto>) {
    const url = `${this.baseUrl}/sessions/${data.id}`;
    const response = await super.get({ url });
    return response.json() as Promise<CheckoutSessionGetResponseDto>;
  }
}
```

**`BaseApi`** provides `.get()`, `.post()`, `.patch()`, `.delete()`, each accepts `{ url, headers?, query?, options? }`.

---

## `*Queries.ts`, Read Hooks (TanStack Query)

- A **plain object** (not a class) with `use*` methods.
- Each method wraps `useQuery` and returns a named query object.
- Use `ApiQueryKeys.<Domain>.<method>(params)` for the `queryKey`.

```ts
export const CheckoutQueries = {
  useGetSession: (data: PayloadOnly<CheckoutSessionGetRequestDto>) => {
    const checkoutSessionGetQuery = useQuery<CheckoutSessionGetResponseDto>({
      queryKey: ApiQueryKeys.Checkout.getSessionBy(data),
      queryFn: () => CheckoutApi.getSession(data),
    });
    return { checkoutSessionGetQuery };
  },
};
```

---

## `*Mutations.ts`, Write Hooks (TanStack Query)

- A **plain object** with `use*` methods.
- Each method wraps `useMutation` and returns a named mutation object.
- Use `ApiMutationKeys.<Domain>.<method>` for the `mutationKey`.
- Invalidate or update related queries inside `onSuccess` using `getQueryClient()` (from `@basekm/lib/queryClient`) — **not** `useQueryClient()` in the calling component. As much as possible, limit query invalidation to this API/mutation layer; a screen or form that calls the mutation shouldn't also need to know which query keys depend on it.
- If the hook accepts caller-supplied `options`, spread `...options` *before* your own `onSuccess` so yours always runs, then explicitly forward to `options?.onSuccess?.(...)` inside it — otherwise a caller passing their own `onSuccess` silently drops your invalidation.

```ts
export const CheckoutMutations = {
  useCreateSession: (
    options?: Omit<UseMutationOptions<void, unknown, PayloadOnly<CheckoutSessionCreateRequestDto>>, 'mutationKey' | 'mutationFn'>,
  ) => {
    const checkoutSessionCreateMutation = useMutation<
      void,
      unknown,
      PayloadOnly<CheckoutSessionCreateRequestDto>
    >({
      mutationKey: ApiMutationKeys.Checkout.createSession(),
      mutationFn: (payload) => CheckoutApi.createSession(payload),
      ...options,
      onSuccess: (data, variables, onMutateResult, context) => {
        getQueryClient().invalidateQueries({ queryKey: ['checkout', 'sessions'] });
        options?.onSuccess?.(data, variables, onMutateResult, context);
      },
    });
    return { checkoutSessionCreateMutation };
  },
};
```

---

## `*PrefetchQueries.ts`, SSR Prefetch

- Plain async functions (not hooks) called from `src/app/` page server components.
- Uses `getQueryClient()` and `queryClient.prefetchQuery(...)`.
- Returns nothing, the query client is dehydrated by the page.

```ts
export const CheckoutPrefetchQueries = {
  prefetchSession: async (data: PayloadOnly<CheckoutSessionGetRequestDto>) => {
    const queryClient = getQueryClient();
    await queryClient.prefetchQuery({
      queryKey: ApiQueryKeys.Checkout.getSessionBy(data),
      queryFn: () => CheckoutApi.getSession(data),
    });
  },
};
```

---

## `ApiQueryKeys`, Query Key Registry

- A **static class** in `src/@shared/api/ApiQueryKeys.ts`.
- Each domain is a static getter returning an inner class with static methods.
- Methods return arrays used as TanStack Query cache keys.

```ts
class ApiQueryKeysCheckout {
  static getSessionBy(data: PayloadOnly<CheckoutSessionGetRequestDto>) {
    return ['checkout', 'session', data.id];
  }
}

export class ApiQueryKeys {
  static get Checkout() { return ApiQueryKeysCheckout; }
}
```

---

## `ApiMutationKeys`, Mutation Key Registry

- Same pattern as `ApiQueryKeys` but for mutation keys.
- Located at `src/@shared/api/ApiMutationKeys.ts`.

---

## Barrel Export

`src/@shared/api/index.ts` re-exports all domain queries, mutations, and prefetch queries so consumers import from `@basekm/api` or `@basekm/@shared/api`.
