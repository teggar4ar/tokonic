# Tokonic Coding Standards

Skim this before adding code in an unfamiliar domain. `AGENTS.md`, `tokonic-technical-design-document.md`, and `docs/security-guidelines.md` remain authoritative.

## Known Deviations Found During Audit

- **Auth action errors are still transitional.** `src/actions/auth.ts` maps expected failures through redirect query parameters instead of the typed `AppError` entry-point mapping defined below. Keep its messages generic; migrate it when the login form adopts structured Server Action state.

The Phase 1 direct seller query previously found in the login page has been moved to `src/server/data/seller.ts`. No current Phase 1 code violates the audited naming, validation-location, server-only, Server Component, or no-ORM rules. Services and provider adapters do not exist yet because their domains start in later phases.

## Naming and File Placement

- Database schemas, tables, columns, constraints, policies, functions, and SQL variables use `snake_case`.
- TypeScript variables, functions, props, and object fields use `camelCase`; types, classes, and React components use `PascalCase`.
- Source filenames use lowercase kebab-case: `require-admin.ts`, `checkout-service.ts`, `database.types.ts`.
- Next.js special files retain framework names: `page.tsx`, `layout.tsx`, `route.ts`, `loading.tsx`, `error.tsx`, `not-found.tsx`, `proxy.ts`.
- Route groups may separate behavior without changing URLs, e.g. `(auth)` and `(protected)`.
- Domain validation lives in `src/lib/validation/<domain>.ts`, one file per domain area.
- Typed Supabase queries live in `src/server/data/<domain>.ts`.
- Business workflows live in `src/server/services/<domain>-service.ts`.
- Provider-specific code lives in `src/server/providers/<provider>/`; separate client, schemas, signatures, and mapper concerns when applicable.
- Shared domain errors live in `src/server/errors/`; shared non-database domain types live in `src/types/`.
- Reusable UI stays under `src/components/`; components never own database queries or commerce rules.

## Layer Responsibilities

### Entry Points: Pages, Server Actions, Route Handlers

- Parse transport input and call the shared Zod schema.
- Verify the user, provider signature, or public-access proof required by that boundary.
- Call a service for business workflows or a data function for a simple read.
- Map internal results/errors to a safe UI state, redirect, or HTTP response.
- Do not contain provider request shapes, reusable SQL/query logic, payment calculations, inventory rules, or multi-step workflows.
- Server Actions do not call provider adapters directly; they call a service.
- Route Handlers call provider adapters only through a service, except a deliberately narrow proxy where the TDD explicitly assigns the handler that responsibility.

### Services: `src/server/services/`

- Own domain decisions, sequencing, invariants, and transactions.
- Call `requireAdmin()` independently for every protected admin operation, even when the entry point already checked.
- Call typed data modules and normalized provider adapters.
- Services may depend on a narrow rate-limit data interface for deterministic tests; they never own process-local production limiter state.
- Never import React, UI components, `next/navigation`, or form-specific types.
- Return domain/view data or throw typed `AppError`; never return raw Supabase/provider responses.

### Data: `src/server/data/`

- Begin with `import "server-only"`.
- Own reusable typed Supabase queries and persistence mapping.
- Independently verify authorization when accessing protected admin data.
- Scope seller-owned queries with the `sellerId` returned by `requireAdmin()`; do not trust a client-supplied seller ID.
- Return selected rows or safe mapped values; do not leak raw database errors.
- Do not own multi-step business rules or call provider adapters.
- The PostgreSQL login limiter uses a dedicated `server-only` data module that owns the privileged RPC call and maps only an allow/deny result; it never exposes raw limiter rows or privileged Supabase responses.

### Providers: `src/server/providers/`

- Begin server-only and read provider secrets only at this boundary.
- Own URLs, headers, timeouts, signatures, provider Zod schemas, and provider-to-domain mapping.
- Return normalized types or throw `ProviderError`; do not expose raw provider payloads upward.
- Never import services, actions, pages, or UI.

### UI: `src/app/` and `src/components/`

- Prefer Server Components. Add `"use client"` only for browser APIs, interactive state, React Hook Form, uploads, or interactive ReUI components.
- Pages compose view data; reusable components receive props and do not query Supabase.
- UI may format values for display but must not become authoritative for money, stock, shipping, ownership, or order state.

## Canonical Phase 1 Flow

A protected simple read follows the established pattern:

```ts
import "server-only";

import { requireAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/server/errors/app-error";

export async function getCurrentSeller() {
  const { sellerId } = await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sellers")
    .select("id, store_name, store_slug")
    .eq("id", sellerId)
    .single();

  if (error || !data) {
    throw new AppError("NOT_FOUND", "Seller data is unavailable", { cause: error });
  }

  return data;
}
```

The page calls `getCurrentSeller()` and renders its result. It does not reproduce the query or authorization logic.

## Import Boundaries

Allowed dependency direction:

```text
UI / Page
  -> Server Action / Route Handler
    -> Service
      -> Data
      -> Provider

Server Component simple read
  -> Data

Login action
  -> Login service
    -> Rate-limit data adapter
      -> Restricted PostgreSQL function

Data / Service
  -> requireAdmin, server Supabase client, domain helpers, errors
```

- `app` and `actions` may import services, data read functions, validation schemas, and UI helpers.
- Services may import data, providers, validation/domain helpers, and server errors.
- Data may import the server Supabase client, authorization helpers, generated database types, and server errors.
- Providers may import provider/domain types, provider validation, and provider errors.
- `lib` must not import from `app`, `actions`, or UI components.
- Data and providers must not import each other; services coordinate them.
- Client Components must not import `server-only` modules, server clients, data, services, providers, or secret env schemas.
- Avoid circular dependencies; lower layers never import higher entry-point layers.

## Zod Schemas

- Put every server-used schema in `src/lib/validation/<domain>.ts`; do not define a second authoritative schema inside a component or action.
- Name schemas by intent: `loginSchema`, `productCreateSchema`, `checkoutSchema`, `orderLookupSchema`.
- Derive input types with `z.infer<typeof schema>` when a separate domain type adds no meaning.
- Apply trimming, normalization, length bounds, enums, UUID checks, integer bounds, and array limits in the shared schema.
- Client forms may import the same browser-safe schema through `zodResolver`; Server Actions and Route Handlers always parse again.
- Provider response schemas belong under their provider directory, not `src/lib/validation/`.
- Validation establishes shape only; services still re-fetch authoritative prices, stock, ownership, shipping rates, and state.

## TypeScript and Data Types

- Keep `strict: true`; do not weaken compiler settings or use `any` to bypass an error.
- Prefer inferred return types for local functions; declare exported domain contracts when they cross layers or clarify meaning.
- Use `unknown` for caught/untrusted values and narrow before access.
- Use generated `Database` types only for Supabase clients and database row/insert/update shapes.
- Do not manually edit `src/lib/supabase/database.types.ts`.
- After every migration: push/dry-run as appropriate, run `npm run db:types`, review the generated diff, then run typecheck and tests.
- Hand-written domain/view types exclude persistence-only fields and provider-specific shapes; define them under `src/types/`.
- Provider transport types never become application domain types without mapping.
- Money is integer/`bigint` rupiah; do not use floating point for persisted or authoritative calculations.

## Error Handling

- Use `AppError` for stable application failures crossing service/data boundaries.
- Use stable codes such as `VALIDATION_ERROR`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, and `INTERNAL_ERROR`.
- Data modules catch/inspect Supabase failures and throw `AppError` with a safe message; attach the original failure as `cause` for server diagnostics.
- Provider adapters normalize transport/schema failures into `ProviderError` with sanitized provider context.
- Services preserve known `AppError` codes and convert unexpected failures to `INTERNAL_ERROR`.
- Entry points are the only layer that maps errors to redirects, action state, HTTP status, or buyer-safe text.
- Never send `cause`, stack traces, SQL details, raw Supabase errors, or raw provider responses to the browser.
- Expected form/domain errors use a consistent safe shape:

```ts
type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };
```

- Log only sanitized identifiers and stable codes. Never log passwords, tokens, secrets, full phones, or full addresses.
- Limiter unavailability and throttling may be distinguished internally only when operationally safe, but the login entry point maps both to the same generic public failure. Never attach raw credentials, client headers, limiter keys, or privileged database errors to browser-visible errors.

## Do / Don't

**Do — share one schema and keep the action thin:**

```ts
const parsed = productCreateSchema.safeParse(input);
if (!parsed.success) return validationFailure();
return createProduct(parsed.data);
```

**Don't — validate and write business logic inside UI:**

```tsx
function ProductForm() {
  const valid = Number(price) > 0;
  return <button onClick={() => supabase.from("products").insert({ price })}>Save</button>;
}
```

The bad version duplicates validation, trusts browser values, bypasses the service/data boundaries, and exposes persistence logic to a Client Component.

## Review Checklist

- [ ] File is in the correct layer and uses the established naming pattern.
- [ ] Import direction follows the allowed dependency graph.
- [ ] Protected boundaries independently authorize; data queries are ownership-scoped.
- [ ] External input is parsed by the shared domain Zod schema.
- [ ] Business logic is in a service, reusable queries are in data, and provider details remain in providers.
- [ ] Client Components contain no server-only imports or authoritative commerce logic.
- [ ] Supabase code uses generated types and no ORM was added.
- [ ] Errors are typed internally and mapped to a safe public shape only at the entry point.
- [ ] `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` pass.
