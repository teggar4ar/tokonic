# Tokonic — Technical Design Document

**Document status:** Draft for implementation  
**Product stage:** Self-study MVP with a possible future commercial path  
**Primary audience:** Solo or small development team  
**Source requirements:** `tokonic-prd.md`  
**Related source:** `tokonic-ringkasan-diskusi.md`  
**Timeline:** TBD  
**Last updated:** 2026-07-22
**Deployment assumption:** One operator-owned development/demo store, as defined in PRD Sections 1.2 and 2.4.  

---

## 1. Purpose

This Technical Design Document translates the Tokonic Product Requirements Document into an implementable system design. It defines the application architecture, module boundaries, database model, security model, external integration boundaries, API contracts, critical transaction algorithms, testing strategy, deployment model, and implementation sequence.

This document is intentionally optimized for an MVP and self-study project. It chooses simple, explicit designs over infrastructure abstraction while preserving payment, inventory, authorization, and personal-data correctness.

### 1.1 Design Goals

Product goals, user requirements, and exclusions are defined in `tokonic-prd.md`. This TDD has the following design goals:

- Keep storefront and seller administration in one modular Next.js codebase.
- Make client-submitted commerce data non-authoritative.
- Isolate provider-specific behavior behind validated adapters.
- Enforce payment idempotency and inventory consistency transactionally.
- Apply authorization at application and data-access boundaries.
- Keep local setup, migrations, tests, and recovery procedures reproducible by one developer.

### 1.2 Product Scope Reference

This document does not redefine product scope. PRD Section 6 owns MVP exclusions, and PRD Section 15 owns resolved and deferred product decisions. Technical choices below implement those requirements.

### 1.3 Architecture Decisions

| Area | Decision |
|---|---|
| Application | Next.js App Router with TypeScript |
| Deployment | One Vercel application deployment |
| Backend platform | One project-owner-managed Supabase project |
| Database | Supabase PostgreSQL |
| Data access | Typed `@supabase/supabase-js` clients plus PostgreSQL functions for atomic workflows |
| Admin authentication | Supabase Auth through `@supabase/ssr` |
| Image storage | Public Supabase Storage bucket with authenticated writes |
| UI | ReUI/shadcn-compatible components, Tailwind CSS, Heroicons |
| Cart implementation | React Context persisted in `localStorage` |
| Provider integration | Server-side RajaOngkir and Duitku adapters |
| Testing | Vitest plus PostgreSQL integration and manual end-to-end tests |

---

## 2. Architecture Overview

### 2.1 System Context

```text
Buyer Browser
  ├─ Public storefront
  ├─ Cart in localStorage
  ├─ Checkout
  └─ Guest order lookup
          │
          ▼
Next.js App Router on Vercel
  ├─ Server Components
  ├─ Client Components
  ├─ Server Actions
  ├─ Route Handlers
  ├─ Domain services
  └─ Provider adapters
      │           │           │
      ▼           ▼           ▼
Supabase      RajaOngkir    Duitku POP
  ├─ Auth        API V2       REST API
  ├─ PostgreSQL                Callback
  └─ Storage
```

### 2.2 Runtime Responsibilities

| Runtime | Responsibilities |
|---|---|
| Browser | Interactive cart, forms, image compression, direct authenticated Storage upload, payment POP UI/redirect |
| Next.js Server Components | Public/admin reads, initial rendering, metadata, authorization-aware page composition |
| Next.js Server Actions | Authenticated admin mutations and checkout orchestration invoked from application forms |
| Next.js Route Handlers | Duitku callbacks, payment initiation endpoint when required by POP client flow, RajaOngkir proxy/search endpoints, guest order lookup if implemented as fetch API |
| PostgreSQL | Durable records, constraints, indexes, RLS, atomic payment/inventory function, summaries |
| Supabase Auth | Single seller-admin identity and session lifecycle |
| Supabase Storage | Public product/store images with policy-protected writes |

### 2.3 Architectural Principles

1. Server Components are the default; Client Components are used only for browser APIs or interaction.
2. Client-submitted prices, stock, shipping fees, order states, and user identities are never authoritative.
3. Server Actions and Route Handlers remain thin and delegate to server-only domain services.
4. Every admin entry point verifies Supabase Auth independently.
5. RLS is defense in depth and applies to every application table exposed through Supabase Data API.
6. Critical multi-table writes execute inside one PostgreSQL transaction/function.
7. Provider payloads are normalized at adapter boundaries.
8. External callbacks are idempotent and auditable.
9. Public order codes are random and non-sequential.
10. No process depends on Vercel instance memory or writable local files.

---

## 3. Technology Stack

| Concern | Technology |
|---|---|
| Language | TypeScript |
| Framework | Next.js App Router |
| UI/runtime | React |
| Styling | Tailwind CSS |
| Components | ReUI and shadcn-compatible primitives |
| Icons | Heroicons |
| Forms | React Hook Form |
| Validation | Zod |
| Database/API client | `@supabase/supabase-js` |
| SSR authentication | `@supabase/ssr` |
| Database | PostgreSQL hosted by Supabase |
| Image storage | Supabase Storage |
| Image preprocessing | `browser-image-compression` |
| Payment | Duitku POP REST integration |
| Shipping | RajaOngkir API V2 Shipping Cost |
| Unit/integration tests | Vitest |
| Hosting | Vercel |
| Local backend | Supabase CLI/local stack when available |

### 3.1 Dependency Policy

- Pin package versions and commit the lockfile.
- Use the currently supported Node.js and TypeScript versions for Next.js and Supabase packages.
- Generate database TypeScript definitions after every schema change.
- Avoid adding an ORM because the selected design uses Supabase typed clients and PostgreSQL functions directly.
- Reassess any provider SDK before installing it; Duitku integration remains direct REST for the MVP.

---

## 4. Application Structure

### 4.1 Proposed Directory Layout

```text
src/
  app/
    (storefront)/
      page.tsx
      produk/[slug]/page.tsx
      keranjang/page.tsx
      checkout/page.tsx
      pesanan/cek/page.tsx
      pesanan/[orderCode]/page.tsx
      privacy/page.tsx
    admin/
      login/page.tsx
      layout.tsx
      page.tsx
      produk/page.tsx
      produk/baru/page.tsx
      produk/[id]/page.tsx
      pesanan/page.tsx
      pesanan/[id]/page.tsx
      pengaturan/page.tsx
    auth/
      callback/route.ts
      reset-password/page.tsx
    api/
      shipping/
        destinations/route.ts
        rates/route.ts
      payments/
        duitku/
          create/route.ts
          callback/route.ts
      orders/
        lookup/route.ts
    layout.tsx
    loading.tsx
    error.tsx
    not-found.tsx
  actions/
    auth.ts
    products.ts
    orders.ts
    settings.ts
  components/
    storefront/
    admin/
    cart/
    forms/
    shared/
    reui/
  contexts/
    cart-context.tsx
  lib/
    supabase/
      browser.ts
      server.ts
      admin.ts
      proxy.ts
      database.types.ts
    auth/
      require-admin.ts
    validation/
      auth.ts
      products.ts
      checkout.ts
      orders.ts
      settings.ts
    money.ts
    phone.ts
    order-code.ts
    image.ts
  server/
    data/
      products.ts
      orders.ts
      seller.ts
      reports.ts
    services/
      checkout-service.ts
      payment-service.ts
      order-service.ts
      product-service.ts
      retention-service.ts
    providers/
      duitku/
        client.ts
        signatures.ts
        schemas.ts
        mapper.ts
      rajaongkir/
        client.ts
        schemas.ts
        mapper.ts
    errors/
      app-error.ts
      provider-error.ts
  types/
    cart.ts
    domain.ts
    providers.ts
supabase/
  config.toml
  migrations/
  seed.sql
tests/
  unit/
  integration/
  fixtures/
```

The exact root alias may differ, but separation between UI, application entry points, domain services, provider adapters, and generated database types must remain.

### 4.2 Component Boundaries

**Server Components:**

- Storefront catalog and product detail reads.
- Admin dashboard/list/detail reads.
- Store metadata and privacy page.
- Order status page after server-side lookup authorization.

**Client Components:**

- Cart provider and controls.
- React Hook Form forms requiring interactive state.
- Duitku POP browser integration.
- Product image compression/upload widget.
- ReUI Data Grid when TanStack state and interactions require a client boundary.
- Image gallery and quantity selectors.

**Server Actions:**

- Admin login/logout where suitable.
- Product create/update/unpublish/delete.
- Order fulfillment transitions.
- Store settings mutation.

**Route Handlers:**

- Duitku callback because it is a third-party server request.
- Duitku payment creation if required by POP browser integration.
- RajaOngkir destination search and rate calculation.
- Guest order lookup when a client-side lookup form uses fetch.
- Supabase Auth callback.

### 4.3 Data Access Layer

Every domain query must live in `server/data` or a domain service, not inside reusable UI components. Modules that access privileged credentials include `import 'server-only'`.

Entry point pattern:

```text
Page / Server Action / Route Handler
  → parse and validate input
  → verify user or provider request
  → call domain service
  → domain service calls typed data/provider adapters
  → map result to safe response/view model
```

---

## 5. Route Design

### 5.1 Public Pages

| Route | Rendering | Purpose |
|---|---|---|
| `/` | Server Component | Store identity and published product catalog |
| `/produk/[slug]` | Server Component | Published product detail |
| `/keranjang` | Client-heavy page | Local cart management |
| `/checkout` | Server shell + Client form | Buyer details, destination, rates, order/payment creation |
| `/pesanan/cek` | Server shell + Client form | Order code and phone lookup |
| `/pesanan/[orderCode]` | Dynamic Server Component | Order status after lookup proof or signed/short-lived access token |
| `/privacy` | Static/Server Component | One-page privacy notice |

### 5.2 Admin Pages

| Route | Purpose |
|---|---|
| `/admin/login` | Supabase Auth login |
| `/admin` | Daily/monthly order and revenue summary |
| `/admin/produk` | Product Data Grid |
| `/admin/produk/baru` | Product creation |
| `/admin/produk/[id]` | Product edit and images |
| `/admin/pesanan` | Order Data Grid |
| `/admin/pesanan/[id]` | Order detail and fulfillment actions |
| `/admin/pengaturan` | Store and origin settings |

`/admin/layout.tsx` redirects unauthenticated users, but every Server Action, Route Handler, and domain mutation must also call `requireAdmin()`.

### 5.3 API Routes

| Method | Route | Authentication | Purpose |
|---|---|---|---|
| GET | `/api/shipping/destinations` | Public, rate-limited | Proxy RajaOngkir direct domestic destination search |
| POST | `/api/shipping/rates` | Public, rate-limited | Validate cart destination/weight and return normalized rates |
| POST | `/api/payments/duitku/create` | Public, rate-limited | Revalidate checkout, create pending order and Duitku invoice |
| POST | `/api/payments/duitku/callback` | Duitku signature | Process provider callback idempotently |
| POST | `/api/orders/lookup` | Public, rate-limited | Verify order code plus normalized phone and return safe status data |
| GET | `/auth/callback` | Supabase flow | Exchange Auth code and redirect |

API route paths may be adjusted to the exact Duitku POP browser integration, but payment creation and callback responsibilities remain separate.

---

## 6. Supabase Client Design

### 6.1 Browser Client

Uses the project URL and publishable key. It is allowed to:

- Perform Supabase Auth login/logout/recovery interactions.
- Upload image objects as the authenticated admin under Storage policies.
- Read public image URLs.

It must not receive a secret/service-role key.

### 6.2 Server Client

Uses `@supabase/ssr` and Next.js cookies. It is used for:

- Verifying the current admin user.
- RLS-aware admin queries and mutations.
- Public reads when a typed client is convenient.
- Server Actions and Server Components.

The session refresh proxy must preserve response cookies exactly as required by the current Supabase SSR documentation.

### 6.3 Privileged Server Client

A service-role/secret-key client may be used only in server-only modules for operations that cannot safely run as a user, such as:

- Duitku webhook processing.
- Retention/anonymization maintenance.
- Operator recovery operations.

Rules:

- Never import it into Client Components.
- Never return its key or raw privileged response.
- Never use it as a shortcut around missing RLS policies for normal admin operations.
- Keep each privileged operation narrow and validated.

### 6.4 Generated Types

Generate and commit TypeScript definitions for the application schema after migrations. Application data modules use `Database` generic typing for Supabase clients. CI or the developer checklist must detect stale generated types after schema changes.

---

## 7. Database Design

### 7.1 General Conventions

- Schema: `public` for MVP application tables.
- Names: lowercase `snake_case`.
- Primary keys: UUID generated by PostgreSQL.
- Time: `timestamptz`, stored in UTC.
- Money: `bigint` integer rupiah.
- Quantities/stock: non-negative `integer`.
- Text limits: enforced with checks where operationally meaningful.
- Foreign keys: explicit `ON DELETE` behavior.
- All foreign-key columns receive indexes unless covered by a suitable composite index.
- All exposed tables have RLS enabled.
- `updated_at` is maintained through application writes or a shared trigger.

### 7.2 Enumerations

Recommended PostgreSQL enums:

```sql
create type order_status as enum (
  'pending',
  'paid',
  'packed',
  'shipped',
  'completed',
  'cancelled',
  'payment_review'
);

create type payment_status as enum (
  'pending',
  'paid',
  'expired',
  'failed',
  'refund_pending',
  'refunded'
);
```

`payment_review` represents confirmed payment where inventory could not be decremented atomically. It is an exception state requiring manual review. If the Duitku integration provides additional statuses, they are mapped into this internal model rather than copied directly into the order state.

### 7.3 `sellers`

One row for the current store.

| Column | Type | Rules |
|---|---|---|
| `id` | `uuid` | PK |
| `auth_user_id` | `uuid` | Unique, references `auth.users(id)` |
| `store_name` | `text` | Required |
| `store_slug` | `text` | Unique, normalized |
| `logo_bucket` | `text` | Nullable |
| `logo_path` | `text` | Nullable |
| `whatsapp_phone` | `text` | Required, normalized international digits |
| `origin_label` | `text` | Required |
| `origin_address` | `text` | Required |
| `origin_rajaongkir_id` | `text` | Required |
| `origin_rajaongkir_level` | `text` | District/subdistrict identifier type |
| `business_timezone` | `text` | Default `Asia/Jakarta` |
| `created_at` | `timestamptz` | Required |
| `updated_at` | `timestamptz` | Required |

Settlement credentials and API secrets do not belong in this table. The project owner's Duitku configuration remains in server environment variables.

### 7.4 `products`

| Column | Type | Rules |
|---|---|---|
| `id` | `uuid` | PK |
| `seller_id` | `uuid` | FK to sellers, required |
| `slug` | `text` | Unique per seller |
| `name` | `text` | Required |
| `description` | `text` | Required, may be empty |
| `price` | `bigint` | `>= 0` |
| `stock` | `integer` | `>= 0` |
| `weight_grams` | `integer` | `> 0`, required for shipping |
| `is_published` | `boolean` | Default false |
| `created_at` | `timestamptz` | Required |
| `updated_at` | `timestamptz` | Required |

Recommended unique constraint: `(seller_id, slug)`.

The product is normally unpublished rather than physically deleted after it has appeared in an order. Hard deletion is allowed only when no order item references it; otherwise retain or soft-delete it.

### 7.5 `product_images`

| Column | Type | Rules |
|---|---|---|
| `id` | `uuid` | PK |
| `product_id` | `uuid` | FK to products, cascade |
| `bucket` | `text` | Required, expected `product-images` |
| `object_path` | `text` | Unique, required |
| `mime_type` | `text` | JPG/PNG/WebP only |
| `byte_size` | `integer` | `> 0 and <= 2097152` |
| `width` | `integer` | Nullable, positive |
| `height` | `integer` | Nullable, positive |
| `display_order` | `smallint` | 0–4 |
| `created_at` | `timestamptz` | Required |

Constraints:

- Unique `(product_id, display_order)`.
- Application and Storage policy enforce at most five images per product.
- Object path format: `products/{product_id}/{uuid}.{ext}`.

### 7.6 `orders`

| Column | Type | Rules |
|---|---|---|
| `id` | `uuid` | PK |
| `seller_id` | `uuid` | FK to sellers, required |
| `order_code` | `text` | Unique, random public identifier |
| `status` | `order_status` | Default pending |
| `payment_status` | `payment_status` | Default pending |
| `buyer_name` | `text` | Required until anonymized |
| `buyer_phone` | `text` | Required until anonymized |
| `buyer_phone_hash` | `text` | Optional lookup-preserving hash strategy; see retention section |
| `buyer_address` | `text` | Required until anonymized |
| `destination_rajaongkir_id` | `text` | Required |
| `destination_label` | `text` | Required snapshot |
| `shipping_provider` | `text` | `rajaongkir` |
| `shipping_courier` | `text` | Required snapshot |
| `shipping_service` | `text` | Required snapshot |
| `shipping_etd` | `text` | Nullable snapshot |
| `shipping_cost` | `bigint` | `>= 0` |
| `subtotal` | `bigint` | `>= 0` |
| `total` | `bigint` | `subtotal + shipping_cost` |
| `total_weight_grams` | `integer` | `> 0` |
| `tracking_number` | `text` | Nullable |
| `submission_key` | `uuid` | Required, unique per seller checkout submission |
| `duitku_merchant_order_id` | `text` | Unique, required after payment creation |
| `duitku_reference` | `text` | Unique, nullable until returned |
| `duitku_payment_url` | `text` | Nullable |
| `invoice_expires_at` | `timestamptz` | Required after creation |
| `paid_at` | `timestamptz` | Nullable |
| `packed_at` | `timestamptz` | Nullable |
| `shipped_at` | `timestamptz` | Nullable |
| `completed_at` | `timestamptz` | Nullable |
| `cancelled_at` | `timestamptz` | Nullable |
| `refund_requested_at` | `timestamptz` | Nullable |
| `refunded_at` | `timestamptz` | Nullable |
| `refund_reason` | `text` | Nullable, required when refund tracking begins |
| `anonymized_at` | `timestamptz` | Nullable |
| `created_at` | `timestamptz` | Required |
| `updated_at` | `timestamptz` | Required |

Check constraints:

- `total = subtotal + shipping_cost`.
- `tracking_number` is required when status is shipped or completed.
- Relevant timestamp consistency may be enforced in application/function logic rather than one complex check.

### 7.7 `order_items`

| Column | Type | Rules |
|---|---|---|
| `id` | `uuid` | PK |
| `order_id` | `uuid` | FK to orders, cascade |
| `product_id` | `uuid` | Nullable FK to products, `ON DELETE SET NULL` |
| `product_name` | `text` | Required snapshot |
| `unit_price` | `bigint` | `>= 0` snapshot |
| `quantity` | `integer` | `> 0` |
| `unit_weight_grams` | `integer` | `> 0` snapshot |
| `line_total` | `bigint` | `unit_price * quantity` |
| `created_at` | `timestamptz` | Required |

Product name, price, and weight snapshots ensure historical order integrity.

### 7.8 `order_status_history`

Include this table in the MVP because it is valuable for payment/fulfillment debugging and self-study.

| Column | Type | Rules |
|---|---|---|
| `id` | `uuid` | PK |
| `order_id` | `uuid` | FK to orders, cascade |
| `from_status` | `order_status` | Nullable for initial state |
| `to_status` | `order_status` | Required |
| `source` | `text` | `system`, `duitku`, `admin`, `retention` |
| `actor_user_id` | `uuid` | Nullable FK to auth.users |
| `reason` | `text` | Nullable, sanitized |
| `created_at` | `timestamptz` | Required |

### 7.9 `payment_events`

Stores sanitized callback evidence and idempotency data.

| Column | Type | Rules |
|---|---|---|
| `id` | `uuid` | PK |
| `order_id` | `uuid` | Nullable FK to orders |
| `provider` | `text` | `duitku` |
| `provider_event_key` | `text` | Unique deterministic idempotency key |
| `merchant_order_id` | `text` | Required |
| `reference` | `text` | Nullable |
| `result_code` | `text` | Required |
| `amount` | `bigint` | Nullable |
| `signature_valid` | `boolean` | Required |
| `processing_result` | `text` | accepted/duplicate/rejected/review |
| `payload` | `jsonb` | Sanitized minimal payload |
| `received_at` | `timestamptz` | Required |
| `processed_at` | `timestamptz` | Nullable |

Do not store secrets, authorization headers, or unnecessary buyer personal data.

### 7.10 Optional `shipping_quote_sessions`

The MVP may avoid this table by recalculating the chosen shipping option during order creation. If quote consistency or provider cost requires a short-lived server record, add:

- Random quote ID.
- Destination ID.
- Weight.
- Normalized options.
- Expiry of approximately 10–15 minutes.

Order creation must still validate that the selected option belongs to the quote and has not expired.

### 7.11 Indexes

Minimum indexes:

```text
sellers(auth_user_id) unique
products(seller_id, is_published, created_at desc)
products(seller_id, slug) unique
product_images(product_id, display_order) unique
orders(order_code) unique
orders(seller_id, submission_key) unique
orders(duitku_merchant_order_id) unique
orders(duitku_reference) unique where not null
orders(seller_id, status, created_at desc)
orders(seller_id, created_at desc)
orders(invoice_expires_at) where status = 'pending'
orders(completed_at) where anonymized_at is null
orders(cancelled_at) where anonymized_at is null
order_items(order_id)
order_items(product_id)
order_status_history(order_id, created_at)
payment_events(provider_event_key) unique
payment_events(merchant_order_id, received_at desc)
```

Index choices must be verified with actual query plans once representative data exists.

---

## 8. Row Level Security Design

### 8.1 Ownership Predicate

A seller-owned row is accessible to the admin only when its `seller_id` maps to a `sellers.auth_user_id` equal to `auth.uid()`.

Do not authorize through user-editable `user_metadata`. Do not treat `TO authenticated` alone as sufficient authorization.

### 8.2 Policy Matrix

| Table | `anon` SELECT | `authenticated` SELECT | Authenticated writes |
|---|---|---|---|
| `sellers` | Public-safe columns only through dedicated query/view | Own seller row | Own row only |
| `products` | Published products only | Own products | Own products |
| `product_images` | Images belonging to published products | Own product images | Own product images |
| `orders` | None | Own seller orders | Through authorized service/functions |
| `order_items` | None | Items for own seller orders | Through checkout/payment services |
| `order_status_history` | None | History for own seller orders | Controlled service/functions |
| `payment_events` | None | Optional read for operator/admin support | Privileged webhook only |

Guest order lookup does not rely on direct anonymous table access. It runs through a server Route Handler using a narrow privileged query after validating order code and normalized phone.

### 8.3 Public Store Reads

Prefer narrow server-side queries for public pages even when RLS allows anonymous published-product reads. If a public database view is used, it must use `security_invoker = true` and expose only storefront-safe columns.

### 8.4 Function Privileges

- Revoke function execution from `PUBLIC` by default.
- Grant each function only to the role that needs it.
- Payment webhook functions are invoked by trusted server code, not public RPC clients.
- Prefer `SECURITY INVOKER`.
- If `SECURITY DEFINER` is necessary, place it in a non-exposed schema, set an empty/safe `search_path`, fully qualify all objects, revoke execution from `PUBLIC`, `anon`, and `authenticated`, and grant only to the intended privileged role.

---

## 9. Supabase Storage Design

### 9.1 Bucket

Bucket name: `product-images`  
Visibility: public  
Allowed MIME types:

- `image/jpeg`
- `image/png`
- `image/webp`

Maximum object size: 2 MB.

Store logo images either in the same bucket under `store/` or in a separate `store-assets` public bucket. A separate bucket is cleaner but not required for MVP.

### 9.2 Object Path

```text
products/{product_id}/{uuid}.{ext}
```

Rules:

- Product ID must reference a product owned by the authenticated seller.
- Extension must match an allowed normalized MIME type.
- UUID prevents collisions and avoids untrusted original filenames.
- Do not overwrite an existing object; use a new UUID and then delete the old object after database update succeeds.

### 9.3 Upload Flow

1. Admin selects up to five images.
2. Client validates apparent type and count.
3. `browser-image-compression` runs with:
   - `maxSizeMB: 2`
   - `maxWidthOrHeight: 1600`
   - `initialQuality: 0.8`
   - `useWebWorker: true`
4. Client verifies the compressed result is an allowed type and <= 2 MB.
5. Product must already exist so its ID can be included in the path.
6. Authenticated browser client uploads the object.
7. Server Action validates object metadata/path and inserts `product_images` row.
8. If database insertion fails, the client/server attempts object cleanup and reports the failure.

### 9.4 Storage Policies

- Public may select objects from `product-images`.
- Authenticated admin may insert only under `products/{owned_product_id}/...`.
- Authenticated admin may update/select/delete only objects for products it owns.
- Avoid upsert; unique object paths simplify permissions and cache behavior.
- Object deletion uses the Storage API, never direct mutation of `storage.objects`.

### 9.5 Image Deletion Consistency

Delete process:

1. Verify admin owns the product and image record.
2. Delete Storage object.
3. Delete database record.
4. If object is already missing, allow database cleanup.
5. If Storage deletion fails for a non-not-found reason, preserve the database row and return an error.

Product deletion/unpublish must enumerate associated object paths if hard deletion is allowed.

---

## 10. Authentication and Authorization

### 10.1 Admin Provisioning

- Disable public signup.
- Project owner creates or invites one seller-admin account in Supabase Auth.
- Create the corresponding `sellers` row with `auth_user_id`.
- Sellers do not create or manage Supabase projects/accounts.

### 10.2 Login

1. Admin submits email/password.
2. Server Action or browser Auth client calls Supabase sign-in.
3. On success, session cookies are set through the supported SSR flow.
4. Redirect to `/admin`.
5. Return a generic error on failure.

### 10.3 Session Verification

`requireAdmin()`:

1. Creates the server Supabase client.
2. Calls the current secure user-verification method from Supabase Auth.
3. Rejects absent/invalid user.
4. Fetches the linked seller row.
5. Returns `{ userId, sellerId }`.

It is called from every admin data module or service, not only the layout.

### 10.4 Password Recovery

- Use Supabase Auth recovery emails.
- Allow redirects only to configured Tokonic development/demo domains.
- Reset-password page validates the recovery session before accepting a new password.
- Rate limit recovery submissions where application-level controls are available.

### 10.5 Logout

Call Supabase sign-out, clear/update cookies through the supported SSR response, and redirect to `/admin/login`.

---

## 11. Cart Design

### 11.1 Client Model

```ts
type CartItem = {
  productId: string
  quantity: number
}

type CartState = {
  version: 1
  items: CartItem[]
}
```

Do not persist product names, prices, images, or totals as authoritative cart data. UI may hydrate display information from server-provided product data.

### 11.2 Persistence

- Key: `tokonic_cart_v1`.
- Validate parsed `localStorage` data with Zod.
- Remove malformed, duplicated, or invalid items.
- Merge duplicate product IDs.
- Quantity remains positive and within a reasonable client cap.

### 11.3 Checkout Revalidation

The server receives only product IDs and quantities. It fetches current products and validates:

- Product exists and is published.
- Quantity is positive.
- Current stock is sufficient at checkout creation time.
- Current price and weight are used.
- Subtotal and total weight are calculated on the server.

This validation does not reserve stock.

---

## 12. RajaOngkir Integration

### 12.1 Selected API

Use RajaOngkir API V2 Shipping Cost. The cost service is live data; do not assume a sandbox/live switch affects it.

### 12.2 Destination UX

Use the V2 direct domestic destination search for a simpler modern MVP:

1. Buyer enters destination text.
2. Client debounces requests to `/api/shipping/destinations`.
3. Server calls RajaOngkir with the API key in a server-only header.
4. Return a normalized list containing provider ID and human-readable hierarchy.
5. Buyer selects one result; free-text address remains a separate field.

The selected destination ID is used for rate calculation. The exact provider response is validated with Zod before mapping.

### 12.3 Normalized Types

```ts
type ShippingDestination = {
  id: string
  label: string
  province?: string
  city?: string
  district?: string
  subdistrict?: string
  postalCode?: string
}

type ShippingRate = {
  quoteKey: string
  courierCode: string
  courierName: string
  serviceCode: string
  serviceName: string
  description?: string
  cost: number
  etd?: string
}
```

`quoteKey` is generated by Tokonic from the normalized option fields and is not trusted as a price by itself.

### 12.4 Rate Request

Inputs:

- Seller origin RajaOngkir ID.
- Buyer destination RajaOngkir ID.
- Server-calculated total weight.
- Configured courier set.

Requirements:

- API key remains server-side.
- Apply timeout with `AbortSignal`.
- Validate HTTP status and provider payload.
- Filter malformed/negative-cost options.
- Return a generic buyer-safe error; log sanitized provider context.
- Rate-limit destination and quote endpoints.

### 12.5 Quote Verification

At final order/payment creation, Tokonic recalculates rates using current product weight and verifies that the selected courier/service/cost still exists. The recalculated provider cost is authoritative. If the price changed, return the updated options and require buyer confirmation.

### 12.6 Tracking

MVP tracking uses the seller-entered courier and tracking number. Automated RajaOngkir waybill tracking is outside the MVP and has no implementation dependency in this design.

---

## 13. Checkout and Order Creation

### 13.1 Checkout Input

```ts
type CheckoutInput = {
  buyerName: string
  buyerPhone: string
  buyerAddress: string
  destinationId: string
  destinationLabel: string
  selectedCourierCode: string
  selectedServiceCode: string
  cart: Array<{
    productId: string
    quantity: number
  }>
  submissionKey: string
}
```

`submissionKey` is a random browser-generated key used to reduce accidental duplicate submission. It is not a payment idempotency key by itself.

### 13.2 Validation

- Trim names and addresses.
- Normalize Indonesian phone input into one canonical digits/international form.
- Set reasonable length bounds.
- Reject empty cart and duplicate product IDs.
- Reject invalid UUIDs or quantities.
- Fetch products by IDs in one query.
- Calculate subtotal and total weight using integer arithmetic.
- Recalculate RajaOngkir rate.
- Calculate `total = subtotal + shipping_cost`.

### 13.3 Creation Sequence

1. Validate checkout input.
2. Resolve seller and current product data.
3. Recalculate shipping rate.
4. Generate random `order_code` and unique `duitku_merchant_order_id`.
5. Open a database transaction/function to insert `orders` and `order_items` snapshots.
6. Request a Duitku POP invoice from server code.
7. Update order with Duitku reference, payment URL/token, and expiration.
8. Return safe payment-initiation data to the browser.

### 13.4 Duitku Creation Failure

If step 6 fails:

- Preserve the order as a traceable pending/payment-failed record or mark its `payment_status = failed`.
- Do not decrement stock.
- Permit a controlled retry that generates a new payment attempt/reference according to Duitku behavior.
- Do not silently create multiple active invoices for one order.

A later implementation may introduce a separate `payment_attempts` table if multiple retries become necessary. For MVP, one active payment attempt per order is preferred.

### 13.5 Duplicate Submission

Server-side duplicate protection is mandatory:

- Disable the form while submitting for user feedback.
- Generate one UUID `submissionKey` per checkout attempt and persist it on the order.
- Enforce unique `(seller_id, submission_key)`.
- When the same submission key is received again, compare a canonical request fingerprint or the persisted order inputs.
- If the repeated request matches, return the existing pending payment result.
- If it differs, return `CONFLICT` and do not create another order or invoice.
- A new buyer attempt after expiry uses a new submission key and creates a new order.

---

## 14. Duitku POP Integration

### 14.1 Adapter Boundary

`server/providers/duitku` owns:

- Environment-specific base URL.
- Merchant code and API key access.
- Signature generation and verification.
- Request/response Zod schemas.
- Mapping provider statuses into internal statuses.
- HTTP timeout/error normalization.

The exact signature string, algorithm, field order, callback response, and endpoint paths must be copied from the current Duitku POP documentation during implementation. They must not be inferred from this TDD.

### 14.2 Configuration

Required conceptual variables:

```text
DUITKU_ENVIRONMENT
DUITKU_MERCHANT_CODE
DUITKU_API_KEY
DUITKU_CALLBACK_URL
DUITKU_RETURN_URL
DUITKU_EXPIRY_PERIOD
```

Exact names may follow the codebase convention. All are server-only except any public POP script configuration explicitly documented by Duitku.

### 14.3 Payment Creation

- Amount comes from persisted/server-calculated order total.
- Merchant order ID is unique and maps to exactly one Tokonic order.
- Callback URL points to the dedicated Route Handler.
- Return URL cannot mark payment successful.
- Buyer information sent to Duitku is minimized to required fields.
- Invoice expiration uses Duitku's built-in expiration capability.

### 14.4 Callback Verification

The callback handler:

1. Reads the provider-supported body format exactly once.
2. Validates required fields.
3. Recomputes and securely compares the signature.
4. Loads order by merchant order ID.
5. Verifies merchant identity, reference relationship, and amount.
6. Derives a deterministic event key.
7. Calls the atomic payment-processing database function.
8. Returns the exact acknowledgment Duitku expects.

Redirect/return requests never perform step 7.

### 14.5 Idempotency

Idempotency is enforced by:

- Unique `payment_events.provider_event_key`.
- Unique merchant order ID.
- Database function checks current order/payment state.
- Stock decrement occurs only in the same transaction that performs the first accepted paid transition.

Duplicate successful callbacks return the provider-compatible success response without changing inventory again.

### 14.6 Atomic Payment and Inventory Algorithm

The privileged PostgreSQL function conceptually performs:

```text
BEGIN
  insert payment event using unique event key
  if event already exists, return duplicate

  select order for update by merchant order id
  verify order amount and allowed state

  if provider says expired and order is pending
    set payment_status = expired
    set status = cancelled
    set cancelled_at
    append history
    mark event accepted
    commit

  if provider says paid
    if order is already paid/packed/shipped/completed
      mark event duplicate
      commit

    lock every referenced product row in deterministic product-id order
    verify every product stock >= ordered quantity

    if any stock is insufficient
      set payment_status = paid
      set status = payment_review
      set paid_at
      append history with insufficient-stock reason
      mark event review
      commit

    update every product with stock = stock - quantity
      with stock >= quantity condition
    verify all expected rows changed

    set payment_status = paid
    set status = paid
    set paid_at
    append history
    mark event accepted
    commit
END
```

Requirements:

- Product locks are acquired in deterministic order to reduce deadlock risk.
- All stock decrements and the order transition succeed or roll back together.
- No negative stock is possible.
- A paid-but-insufficient-stock order preserves payment evidence and enters `payment_review` rather than pretending payment failed.
- `payment_review` requires seller action and potentially a manual refund.

### 14.7 Expiration Reconciliation

A provider expiration callback is the preferred trigger. Because callback behavior must be confirmed against Duitku documentation, add a fallback reconciliation mechanism if expired invoices are not guaranteed to produce callbacks:

- Admin-visible “reconcile expired orders” action, or
- Scheduled endpoint/job that cancels local pending orders whose `invoice_expires_at` has passed after verifying provider state where required.

No stock release occurs because pending orders never reserve stock.

### 14.8 Refunds

- No automated refund API integration.
- Seller manually processes the refund through the appropriate Duitku/financial process.
- Admin records `refund_pending` when manual refund handling begins and `refunded` after completion; recording a reason and timestamp is mandatory.
- A refund does not automatically restore stock; seller decides whether returned/cancelled goods are sellable and updates stock manually.

---

## 15. Order State Machine

### 15.1 Normal Transitions

```text
pending ──verified paid callback──> paid
paid ──admin──> packed
packed ──tracking number + admin──> shipped
shipped ──admin confirmation──> completed
```

### 15.2 Cancellation and Review

```text
pending ──Duitku expiration──> cancelled
pending ──admin before payment──> cancelled
pending ──verified payment but insufficient stock──> payment_review
payment_review ──inventory secured/manual fulfillment approved──> paid
payment_review ──manual refund completed──> cancelled
```

`payment_review → paid` requires the seller to confirm that inventory/fulfillment has been secured; it does not decrement stock automatically unless an explicit reviewed adjustment is performed. `payment_review → cancelled` is allowed only after the seller records that the manual refund was completed. Normal `paid` and `packed` orders are not cancelled in the MVP workflow.

### 15.3 Transition Enforcement

- Define one pure TypeScript transition validator for UI/service feedback.
- Revalidate inside the database mutation/function for authoritative transitions.
- Insert `order_status_history` for every transition.
- Only verified Duitku processing may set normal orders to `paid`.
- `shipped` requires courier, service, and tracking number.
- Backward transitions are disallowed except explicit recovery operations.

---

## 16. Guest Order Lookup

### 16.1 Request

```ts
type OrderLookupInput = {
  orderCode: string
  buyerPhone: string
}
```

### 16.2 Processing

1. Normalize order code and phone.
2. Rate limit by IP and request fingerprint where practical.
3. Query using a privileged server module with both values.
4. Return the same generic not-found response for every mismatch.
5. Return only the safe view model.

### 16.3 Safe Response

```ts
type PublicOrderStatus = {
  orderCode: string
  status: string
  createdAt: string
  items: Array<{
    productName: string
    quantity: number
    unitPrice: number
    lineTotal: number
  }>
  subtotal: number
  shippingCost: number
  total: number
  courier: string
  service: string
  trackingNumber?: string
  shippedAt?: string
  completedAt?: string
}
```

Do not expose full address, provider payload, merchant credentials, internal UUIDs, or unrelated buyer details.

### 16.4 Access Continuity

After successful code-and-phone verification, either:

- Return status directly in the same interaction, or
- Issue a short-lived signed HttpOnly lookup cookie/token scoped to that order before redirecting to `/pesanan/[orderCode]`.

Do not place the buyer phone in the URL.

---

## 17. Product Administration

### 17.1 Product Create

1. Verify admin and seller.
2. Validate name, slug, description, price, stock, weight, and publication state.
3. Insert product without images.
4. Compress/upload optional images using the Storage flow.
5. Insert image records.
6. Allow publication with zero images; the storefront renders the standard fallback image.
7. Revalidate storefront/admin product paths.

### 17.2 Product Update

- Price, stock, weight, and description changes affect future checkout only.
- Existing order item snapshots remain unchanged.
- Slug changes should redirect or return not-found; redirect history is excluded from MVP.
- Stock adjustments must be explicit integer values and logged at application level if an audit table is not added.

### 17.3 Product Delete

Preferred behavior after any order reference: unpublish rather than hard-delete.

Hard-delete sequence for an unreferenced product:

1. Verify ownership.
2. Gather image paths.
3. Delete Storage objects.
4. Delete product, cascading image records.
5. Revalidate product/catalog paths.

---

## 18. Admin Orders and Reporting

### 18.1 Order List

Server query parameters:

- `page`.
- `pageSize`, bounded to an allowed set.
- `status`.
- Optional order-code search.
- Sort fixed to newest first for MVP.

Use ReUI Data Grid with loading, empty, error, pagination, and horizontal overflow states.

### 18.2 Order Detail

Includes:

- Buyer fulfillment information.
- Order item snapshots.
- Payment/reference status.
- Shipping snapshot.
- Tracking number.
- Status history.
- Manual actions allowed from the current state.

### 18.3 Sales Summary

MVP revenue definition:

- Include orders with payment status `paid`, `refund_pending`, or `refunded` according to explicitly labelled figures.
- Main gross-sales figure uses paid transaction total before refunds.
- Show `refund_pending` and `refunded` totals separately from gross paid sales.
- Exclude pending, expired, failed, and unpaid cancelled orders.
- Group date boundaries using seller `business_timezone`, default `Asia/Jakarta`.

Queries:

- Count orders by day/month.
- Sum gross paid totals by day/month.
- Count current actionable states: paid, packed, payment_review.

Use parameterized SQL/database functions for timezone grouping if Supabase query syntax becomes cumbersome.

---

## 19. Privacy and Data Retention

### 19.1 Retention Implementation

The one-year retention outcome is defined in PRD Section 8.2. The anonymization operation:

- Replaces `buyer_name` with an anonymized marker or `NULL` if schema permits.
- Removes `buyer_phone` and `buyer_phone_hash`.
- Removes `buyer_address`.
- Removes unnecessary personal fields from sanitized provider payloads.
- Sets `anonymized_at`.
- Preserves order code, non-identifying item snapshots, totals, statuses, timestamps, shipping service, and aggregate-reporting data.

### 19.2 Lookup After Anonymization

Guest phone-based lookup stops working after anonymization. The privacy notice must state this operational consequence. Do not retain a reversible phone value only to keep lookup working.

If `buyer_phone_hash` is retained, treat it as personal/pseudonymous data and justify it. The simplest MVP is to delete it during anonymization too.

### 19.3 Retention Execution

For development:

- Implement a protected/manual retention command or database function.
- Test against seeded orders with historical timestamps.

Before commercial production:

- Schedule the operation through an approved scheduler.
- Make it idempotent.
- Log counts and failures without logging personal data.

### 19.4 Privacy Notice Delivery

The notice content is defined in PRD Section 8.2. Implement it as a public `/privacy` page linked from checkout and the storefront footer. Keep the content editable in the codebase for MVP; no CMS is required.

---

## 20. Validation and Error Model

### 20.1 Validation Layers

1. Client validation for fast feedback.
2. Server Zod validation for every action/handler.
3. Provider response validation with Zod.
4. PostgreSQL constraints for durable invariants.
5. RLS and authorization checks for access control.

### 20.2 Error Categories

```ts
type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'OUT_OF_STOCK'
  | 'SHIPPING_UNAVAILABLE'
  | 'PAYMENT_CREATION_FAILED'
  | 'PAYMENT_VERIFICATION_FAILED'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
```

Public responses contain stable codes and safe messages. Logs may contain correlation IDs and sanitized technical details.

### 20.3 External Timeouts and Retries

- RajaOngkir search/rate calls use short bounded timeouts.
- Duitku payment creation uses a bounded timeout.
- Do not automatically retry non-idempotent payment creation without an idempotency/reconciliation strategy.
- Webhook database processing may retry only on known transient database failures and must remain idempotent.
- Use exponential backoff only for safe repeatable operations.

---

## 21. Caching and Revalidation

### 21.1 Public Catalog

Public product/store reads may use Next.js cache tags:

- `store-settings`.
- `products`.
- `product:{id}`.

After admin mutation:

- Revalidate affected tag/path.
- Product stock changed by payment webhook must invalidate product/catalog data or public reads must be dynamic enough to avoid stale purchasability.

For MVP correctness, checkout always reads fresh server data regardless of storefront cache.

### 21.2 Admin and Orders

Admin order/payment pages are dynamic and must not serve shared cached personal data. Use request-time rendering and avoid public caching.

### 21.3 Provider Routes

- Payment callback: never cached.
- Payment creation: never cached.
- Shipping rates: never treated as durable; brief application/browser deduplication is acceptable.
- Destination search may use a short cache if provider terms allow it.

---

## 22. Security Design

### 22.1 Secrets

Server-only:

- Supabase secret/service-role key.
- Database direct connection credentials if used by migrations.
- RajaOngkir API key.
- Duitku merchant code/API key and signature inputs.

Public:

- Supabase project URL.
- Supabase publishable key.
- Any Duitku POP browser identifier explicitly documented as public.

### 22.2 Request Security

- HTTPS in production.
- Validate content type and body size on API handlers.
- Verify origin/CSRF properties for cookie-authenticated mutations.
- Route Handlers and Server Actions re-check authorization.
- Verify Duitku callback signature and amount.
- Normalize phone/order lookup inputs.
- Apply rate limits to login, recovery, shipping search/rates, checkout/payment creation, and order lookup.
- Never interpolate user input into raw SQL.

### 22.3 RLS Verification

Test as:

- `anon`.
- Authenticated admin.
- A second synthetic authenticated user with no seller relationship.
- Privileged webhook service.

The second user must not read or mutate seller data even though it has the `authenticated` role.

### 22.4 Content Safety

- Render product descriptions as plain text or sanitized rich text; MVP should use plain text.
- Escape all seller/buyer content through React rendering.
- Do not accept SVG uploads because active content and script risks exceed MVP needs.
- Do not trust file extension alone; validate MIME and decoded image processing result.

### 22.5 Logging

Never log:

- Passwords or Auth tokens.
- Supabase keys.
- Duitku/RajaOngkir secrets.
- Full buyer addresses or phones.
- Complete raw callback payloads without sanitization.

Use:

- Order code.
- Merchant order ID.
- Provider reference.
- Correlation ID.
- Outcome/error code.
- Sanitized provider status.

---

## 23. Environment Configuration

Conceptual environment variables:

```text
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
RAJAONGKIR_API_KEY
RAJAONGKIR_BASE_URL
DUITKU_ENVIRONMENT
DUITKU_MERCHANT_CODE
DUITKU_API_KEY
DUITKU_CALLBACK_URL
DUITKU_RETURN_URL
DUITKU_EXPIRY_PERIOD
```

Rules:

- Validate environment variables at startup/build with a server/client-separated schema.
- Never prefix secrets with `NEXT_PUBLIC_`.
- Maintain `.env.example` without values.
- Use distinct Duitku sandbox and production configuration.
- Fail fast when required configuration is absent.

---

## 24. Database Migrations and Local Development

### 24.1 Workflow

Use Supabase CLI and migration files as the source of truth.

1. Initialize/link local project.
2. Develop schema locally when possible.
3. Create reviewed migration files.
4. Apply migrations to development/staging before production.
5. Generate TypeScript database types.
6. Run Supabase security and performance advisors.
7. Seed one seller/admin-linked development record and sample catalog safely.

Do not make untracked production schema edits through the dashboard.

### 24.2 Migration Ordering

1. Extensions/types.
2. Tables.
3. Constraints and indexes.
4. Updated-at function/trigger.
5. RLS enablement.
6. Grants and policies.
7. Transactional functions.
8. Storage bucket/policies.
9. Seed data kept separate from production migrations.

### 24.3 Backup

Supabase Free plan does not provide automatic database backups. For development:

- Keep schema and seed data reproducible in version control.
- Export important demo data manually when needed.

Before any commercial production use:

- Move to a backup-capable plan or implement and test scheduled exports.
- Document restore and rollback procedures.

---

## 25. Testing Strategy

### 25.1 Unit Tests

- Integer subtotal, shipping, and grand total calculations.
- Weight calculations.
- Phone normalization.
- Order-code validation/generation properties.
- Order transition validator.
- RajaOngkir response mapping.
- Duitku request mapping and signature functions using official fixtures.
- Duitku callback validation and status mapping.
- Image validation helpers.
- Retention eligibility calculation.

### 25.2 Database Integration Tests

Run against local/test Supabase PostgreSQL:

- Constraints reject negative stock, money, weight, or quantity.
- RLS policy matrix for anon/admin/unrelated authenticated user.
- Atomic payment function decrements all products exactly once.
- Duplicate callback does not decrement stock twice.
- Insufficient stock produces `payment_review` and no partial decrement.
- Concurrent successful callbacks produce one accepted transition.
- Expiration cancels pending order without stock changes.
- Order snapshots survive product updates/unpublish/delete behavior.
- Retention function anonymizes only eligible orders.

### 25.3 Route/Service Integration Tests

- Shipping destination and rate adapter with recorded fixtures/mocks.
- Checkout rejects tampered prices and shipping costs.
- Payment creation uses persisted total.
- Callback rejects invalid signature, amount, merchant ID, and unknown order.
- Guest lookup requires both order code and normalized phone.
- Admin service rejects no-session and unrelated users.

### 25.4 Manual End-to-End Tests

- Auth login/logout/recovery and direct unauthorized access.
- Product CRUD and image upload/delete limits.
- Local cart persistence and malformed-state recovery.
- RajaOngkir destination search and rate failure states.
- Duitku POP methods enabled on sandbox account.
- Successful, duplicate, invalid, mismatched, expired, and out-of-order callbacks.
- Atomic inventory behavior under two competing checkouts.
- Paid order with insufficient stock enters review.
- Fulfillment transitions and tracking display.
- Privacy notice and one-year anonymization test with seeded timestamps.
- Mobile and keyboard behavior.

### 25.5 Acceptance Gate

- Lint and typecheck pass.
- Critical Vitest suites pass.
- Database integration tests pass.
- Supabase advisors show no unresolved critical security issue.
- Duitku sandbox flow completes.
- RajaOngkir live cost API integration handles valid and failure cases.
- No known total, stock, auth, RLS, or personal-data critical defect.

---

## 26. Observability and Recovery

### 26.1 Structured Events

Log these events with correlation identifiers:

- `shipping.destination.failed`.
- `shipping.rate.failed`.
- `checkout.created`.
- `payment.create.failed`.
- `payment.callback.received`.
- `payment.callback.rejected`.
- `payment.callback.duplicate`.
- `payment.callback.accepted`.
- `payment.inventory.review`.
- `order.transition.rejected`.
- `storage.orphan.detected`.
- `retention.completed`.

### 26.2 Admin Recovery

Document manual procedures for:

- Payment confirmed by provider but callback missing.
- Duplicate callback.
- Paid order in `payment_review`.
- Manual refund tracking.
- Storage object missing or orphaned.
- RajaOngkir outage.
- Supabase project paused.
- Auth account recovery.

Recovery actions must use narrow scripts/admin functions and preserve history rather than direct ad hoc row edits where possible.

---

## 27. Performance and Capacity

### 27.1 Capacity Assumptions

Implementation sizing follows the one-store, low-traffic scope in PRD Section 9.4. No horizontal scaling, partitioning, read replicas, or background worker infrastructure is required for the MVP.

### 27.2 Performance Measures

- Fetch explicit columns, not `select *` in application queries.
- Paginate admin lists.
- Index foreign keys and common status/date filters.
- Avoid N+1 item/image queries by using relational selects or bounded grouped queries.
- Keep public images to practical rendered dimensions.
- Debounce RajaOngkir destination search.
- Use one shipping rate call per meaningful checkout change.
- Keep webhook processing short and transactional.

### 27.3 Free-Tier Monitoring

Monitor:

- Database size.
- Storage bytes.
- Cached and uncached egress.
- Project inactivity/pausing.
- Auth and API quotas.

The Free plan is not the assumed production-commercial plan.

---

## 28. Deployment Design

### 28.1 Environments

Minimum:

- Local development.
- Vercel preview with Supabase development project.
- Vercel production/demo with controlled credentials.

A separate Supabase staging project is desirable but optional under Free plan active-project limits.

### 28.2 Deployment Sequence

1. Apply reviewed Supabase migrations.
2. Generate/verify database types.
3. Configure Auth redirect URLs.
4. Configure Storage bucket and policies.
5. Configure Vercel environment variables.
6. Deploy Next.js.
7. Configure Duitku callback/return URLs.
8. Run smoke tests.
9. Verify RLS and webhook behavior.

### 28.3 Rollback

- Application: redeploy previous known-good Vercel build.
- Database: prefer forward-fix migrations; destructive migrations require explicit rollback scripts and backup.
- Provider: retain sandbox configuration until production readiness review.
- Storage: object deletion is not automatically reversible on Free plan; avoid destructive bulk operations.

---

## 29. Implementation Plan

### Phase 1 — Foundation (DONE)

- Scaffold Next.js TypeScript application.
- Configure Tailwind, ReUI/shadcn-compatible setup, and Heroicons.
- Configure Supabase local/remote clients and generated types.
- Create initial schema, RLS, seller seed, and Auth integration.
- Implement admin login and protected layout/service guard.

### Phase 2 — Catalog and Storage

- Implement store settings.
- Implement products and product images tables/policies.
- Implement image compression and Storage upload/delete.
- Implement product admin Data Grid and forms.
- Implement public catalog/product detail.
- Implement cart Context and persistence.

### Phase 3 — Shipping and Checkout

- Implement RajaOngkir destination search adapter.
- Implement rate adapter and normalized types.
- Implement checkout validation and fresh cart revalidation.
- Implement order/order-item transaction and snapshots.

### Phase 4 — Payments and Inventory

- Implement Duitku POP request adapter using current official docs.
- Implement payment creation.
- Implement callback verification.
- Implement payment events and atomic inventory function.
- Test duplicate, insufficient-stock, mismatch, and expiration paths.

### Phase 5 — Fulfillment and Reporting

- Implement order admin Data Grid/detail.
- Implement status transitions and history.
- Implement tracking number and guest lookup.
- Implement basic daily/monthly summary.
- Implement WhatsApp links.

### Phase 6 — Privacy and Hardening

- Implement one-page privacy notice.
- Implement manual retention/anonymization operation.
- Complete RLS/security matrix tests.
- Complete manual end-to-end tests.
- Add recovery documentation and deployment checklist.

---

## 30. Implementation-Level Open Items

These items do not change the resolved product architecture but must be finalized while coding:

1. **Implementation-blocking:** Confirm exact Duitku POP endpoint paths, request fields, signature algorithms, callback fields, acknowledgment body, and expiration callback behavior from current official documentation. If expiration callbacks are not guaranteed, implement the reconciliation fallback in Section 14.7 before claiming automatic cancellation.
2. **Implementation-blocking:** Confirm exact RajaOngkir V2 cost endpoint fields, enabled couriers, account quota, and response schema before checkout integration.
3. Decide whether payment creation uses a Route Handler exclusively or a thin Server Action that calls the same service.
4. Decide whether guest order detail uses a same-page response or short-lived signed lookup cookie.
5. **Security-blocking:** Select and verify the rate-limit mechanism before exposing public lookup, shipping, and payment-creation endpoints.
6. Decide whether a separate `payment_attempts` table is needed after retry behavior is tested.
7. Decide whether store logo uses `product-images/store/` or a separate bucket.
8. Decide whether client image compression preserves input format or consistently converts supported inputs to WebP after compatibility testing.

Every item must be documented in code-facing architecture notes or an ADR when resolved.

---

## 31. Technical Definition of Done

Functional completion is defined in PRD Sections 1.5, 11, and 16. Technical evidence is complete when:

- The application can be recreated from repository instructions, migrations, generated types, and documented environment configuration.
- Lint, typecheck, critical Vitest suites, and PostgreSQL integration tests pass.
- The RLS matrix blocks anonymous and unrelated authenticated access as designed.
- Payment idempotency, atomic inventory, insufficient-stock review, expiration reconciliation, and duplicate-submission invariants pass concurrency/integration tests.
- Storage MIME, size, count, path, ownership, deletion, and orphan-cleanup behavior is verified.
- The retention operation is idempotent and anonymizes only eligible records.
- Supabase advisors show no unresolved critical security finding.
- No secret is exposed to browser bundles, logs, or repository history.
- Deployment smoke tests and recovery procedures have been exercised.

---

## Appendix A — PRD-to-TDD Traceability

| PRD area | TDD sections |
|---|---|
| Architecture and stack | 2–6 |
| Storefront and cart | 4–5, 11 |
| Checkout and shipping | 12–13 |
| Payment and webhook | 14 |
| Inventory correctness | 14.6, 25 |
| Order states and fulfillment | 15, 18 |
| Guest lookup | 16 |
| Product/image management | 9, 17 |
| Supabase Auth | 6, 10 |
| Database and RLS | 7–8 |
| Security/privacy | 19, 22 |
| Testing | 25 |
| Hosting and operations | 23–29 |
| Deferred decisions | 30 |

## Appendix B — Documentation Constraints Applied

- Current Next.js guidance requires authorization checks inside every Server Action and Route Handler; hiding UI or protecting only a layout is insufficient.
- Next.js Route Handlers are used for third-party callbacks and must not rely on shared serverless memory or writable local storage.
- Current Supabase Next.js guidance uses `@supabase/ssr` browser/server clients with cookie refresh and verified user checks.
- Supabase RLS policies use explicit ownership predicates; the `authenticated` role alone is not authorization.
- Supabase secret/service-role keys remain server-only.
- Supabase Storage supports bucket-level MIME/size restrictions and RLS policies for object paths; object operations use the Storage API.
- PostgreSQL privileged functions require explicit execution grants, safe `search_path`, and careful use of `SECURITY DEFINER`.
- RajaOngkir API V2 supports direct domestic destination search and cost calculation using destination IDs; the API key remains server-side and Shipping Cost uses live data.
- Duitku POP supplies the payment-method selection UI for faster integration; exact request/callback/signature contracts must be taken from the current POP API documentation during implementation.
- `browser-image-compression` supports `maxSizeMB`, `maxWidthOrHeight`, `initialQuality`, and Web Worker processing for JPG, PNG, and WebP inputs.

These constraints were current when this TDD was written and must be revalidated when implementation begins.
