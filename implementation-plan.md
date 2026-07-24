---
goal: Complete Tokonic Single-Store Self-Study MVP
version: 1.0
date_created: 2026-07-23
last_updated: 2026-07-23
owner: Tokonic Operator
status: 'In progress'
tags: [feature, architecture, security, ecommerce, nextjs, supabase, payments]
---

# Introduction

![Status: In progress](https://img.shields.io/badge/status-In%20progress-yellow)

This plan completes the operator-owned, single-store Tokonic MVP. It records the completed Phase 1 foundation, adds a Phase 1 remediation stage, and decomposes Technical Design Document Phases 2–6 into atomic agent-session tasks. It excludes multi-seller architecture, public seller onboarding, subscription billing, and automated per-seller provisioning. Password recovery and the Supabase Auth callback route are explicitly deferred. The initial database schema remains limited to Supabase Auth and the `sellers` table until the sequenced Phase 2 schema migration begins.

**Progress update discipline:** Whenever a task is completed, update both its checklist checkbox and its table `Completed`/`Date` columns in the same edit so they never drift out of sync.

**Database test execution:** Database, Auth, Storage, RLS, migration, and concurrency integration tests run only in a CI-hosted disposable Supabase stack on GitHub Actions. The operator's machine is never required to run Docker, and automated tests must never target the shared remote Supabase project. This creates a push-based feedback loop: database results are available only after pushing and waiting for CI, so database changes should be kept small and pushed frequently with the green workflow run URL recorded as evidence.

## 1. Requirements & Constraints

- **REQ-001**: Deliver one operator-owned development/demo store supporting catalog, cart, checkout, RajaOngkir shipping, Duitku payment, inventory updates, fulfillment, guest tracking, store settings, and basic sales reporting.
- **REQ-002**: Preserve the completed Phase 1 foundation: Next.js App Router scaffold, strict TypeScript, Tailwind, shadcn-compatible primitives, Heroicons, Supabase SSR clients, seller/Auth schema, login, logout, protected admin layout, `requireAdmin()`, generated database types, and baseline unit tests.
- **REQ-003**: Add a Phase 1 remediation stage before catalog implementation to establish CI-hosted disposable database integration testing, runtime RLS verification, environment validation, operator provisioning, login rate limiting, and UI design tokens.
- **REQ-004**: Provision the sole CI test admin through an environment-driven operator script that creates or updates the Supabase Auth user and links exactly one `sellers` row without committing credentials or fixed generated identifiers.
- **REQ-005**: Keep the initial schema limited to Supabase Auth and `sellers`; introduce products, images, orders, payment events, history, and transactional functions only through later ordered migrations.
- **REQ-006**: Defer password recovery, reset-password UI, and `/auth/callback` implementation; retain login and logout as the Phase 1 authentication scope.
- **REQ-007**: Store authoritative money values as PostgreSQL `bigint` and TypeScript integer/`bigint` rupiah; never use floating-point arithmetic for totals.
- **REQ-008**: Recalculate product prices, availability, stock, weight, shipping cost, subtotal, and total on the server during final checkout.
- **REQ-009**: Keep the cart browser-local under `tokonic_cart_v1`, persist only product IDs and quantities, validate restored state, and treat all cart values as untrusted.
- **REQ-010**: Use RajaOngkir API V2 for destination search and shipping costs through server-only validated adapters with bounded timeouts and safe errors.
- **REQ-011**: Recalculate the selected RajaOngkir option during order creation and require buyer acceptance when the authoritative cost changes.
- **REQ-012**: Use direct Duitku POP REST integration based on current official provider documentation; do not install or infer behavior from an unmaintained SDK.
- **REQ-013**: Permit only a verified Duitku callback to establish successful payment; browser return or redirect requests must never mark an order paid.
- **REQ-014**: Do not reserve stock during checkout or pending payment; decrement stock only after verified successful payment.
- **REQ-015**: Process payment evidence, order transition, status history, and all stock decrements in one idempotent database transaction.
- **REQ-016**: Preserve paid evidence and move the order to `payment_review` without partial stock decrement when inventory is insufficient at callback time.
- **REQ-017**: Enforce the normal order flow `pending → paid → packed → shipped → completed`, pending cancellation, and explicit `payment_review` recovery transitions.
- **REQ-018**: Require both a random order code and normalized buyer phone for guest lookup, return one generic mismatch result, and expose only the approved public order view.
- **REQ-019**: Preserve historical order-item name, price, weight, quantity, and line-total snapshots after product updates, unpublishing, or permitted deletion.
- **REQ-020**: Support JPG/JPEG, PNG, and WebP product images, at most five images per product, at most 2 MB per stored image, and no SVG.
- **REQ-021**: Provide product management, image management, store settings, public catalog, product detail, cart, admin order processing, tracking, WhatsApp links, and daily/monthly sales summaries.
- **REQ-022**: Retain buyer-identifying order data for one year after completion or cancellation, then anonymize it idempotently while preserving non-identifying transaction history.
- **REQ-023**: Publish a one-page privacy notice linked from the storefront and checkout.
- **REQ-024**: Provide loading, empty, error, success, disabled, hover, active, focus, mobile, and desktop states for each relevant screen.
- **REQ-025**: Use Bahasa Indonesia for buyer-facing and admin-facing product copy, with concise action-specific labels and recoverable error guidance.
- **REQ-026**: Complete sandbox checkout, payment, fulfillment, guest lookup, retention, responsive, accessibility, and recovery acceptance exercises before MVP completion.
- **SEC-001**: Every protected Server Action, Route Handler, service, and protected data operation must independently verify the Supabase Auth user through `requireAdmin()` or an equivalent secure guard.
- **SEC-002**: Enable RLS on every table exposed through the Supabase Data API and authorize seller-owned rows through `seller_id` or ownership joins to `sellers.auth_user_id = auth.uid()`.
- **SEC-003**: Prove RLS at runtime for `anon`, the owning admin, and an unrelated authenticated user; authenticated role membership alone must grant no seller access.
- **SEC-004**: Keep `SUPABASE_SECRET_KEY`, RajaOngkir credentials, Duitku credentials, database credentials, and signing material in server-only modules and out of browser bundles, fixtures, logs, and source control.
- **SEC-005**: Validate every Server Action and Route Handler input through a shared domain Zod schema under `src/lib/validation/`.
- **SEC-006**: Validate provider payloads at provider boundaries, allowlist provider hosts, apply bounded request timeouts, and expose only normalized responses or sanitized errors.
- **SEC-007**: Verify Duitku signature, merchant identity, merchant order relationship, provider reference, result, and integer amount before any payment business effect.
- **SEC-008**: Use deterministic payment event keys and unique database constraints so replayed or concurrent callbacks cannot duplicate order or stock effects.
- **SEC-009**: Acquire product locks in deterministic product-ID order and conditionally decrement using `stock >= quantity`; reject negative or partial inventory outcomes.
- **SEC-010**: Guest lookup must never directly grant anonymous table access, place phone data in URLs, reveal which credential mismatched, or return addresses, phones, internal UUIDs, or provider payloads.
- **SEC-011**: Storage writes must verify ownership and object paths, reject unsafe MIME types, avoid upsert and original filenames, and delete objects through the Storage API.
- **SEC-012**: Apply reviewed rate limiting to login, destination search, shipping rates, checkout/payment creation, and guest order lookup before those routes are publicly exposed.
- **SEC-013**: Use generic login failures and enable Supabase leaked-password protection before production/demo public exposure.
- **SEC-014**: Revoke PostgreSQL function execution from `PUBLIC`; narrowly grant transactional functions and secure any required `SECURITY DEFINER` function with a safe `search_path` and fully qualified objects.
- **SEC-015**: Never log passwords, tokens, provider secrets, callback authorization data, full buyer phones, full addresses, or unsanitized callback payloads.
- **CON-001**: Implement only one operator-owned store and one seller-admin account; no multi-tenant data sharing, external seller onboarding, subscription billing, or per-seller infrastructure provisioning.
- **CON-002**: Use one Next.js application, one Supabase project, one operator Duitku account, and one operator RajaOngkir account.
- **CON-003**: Do not add an ORM; use typed Supabase clients and PostgreSQL functions.
- **CON-004**: Prefer Server Components; use Client Components only for browser APIs or required interaction.
- **CON-005**: Server Actions and Route Handlers must remain thin; domain workflows belong in `src/server/services/`, reusable queries in `src/server/data/`, and provider details in `src/server/providers/`.
- **CON-006**: Migrations, generated database types, `package.json`, lockfile, shared configuration, and shared global styles are serialization points and must not be edited concurrently.
- **CON-007**: Package versions must be pinned and the lockfile committed whenever dependencies change.
- **CON-008**: Database migration files are immutable after application; corrections use new forward migrations.
- **CON-009**: Automated database and concurrency tests must target a CI-hosted disposable Supabase stack in GitHub Actions, never local Docker and never the shared remote development project.
- **CON-010**: No process may depend on Vercel instance memory, writable local runtime files, automatic refunds, automatic stock restoration, or automatic courier booking.
- **GUD-001**: Follow `tokonic-prd.md` for product behavior and acceptance outcomes.
- **GUD-002**: Follow `tokonic-technical-design-document.md` for architecture, schema, state machines, integrations, testing, deployment, and recovery.
- **GUD-003**: Follow `docs/security-guidelines.md` for authorization, RLS, secrets, provider, upload, logging, and review controls.
- **GUD-004**: Follow `docs/ui-ux-guidelines.md` for trustworthy Swiss-modern commerce, semantic tokens, mobile-first storefronts, responsive admin screens, accessibility, and ReUI reuse.
- **GUD-005**: Follow `docs/testing-guidelines.md` for Vitest structure, disposable database integration tests, provider fixtures, critical-path automation, and manual E2E evidence.
- **GUD-006**: Follow `docs/coding-standards.md` for naming, layering, imports, validation placement, error handling, and strict TypeScript.
- **GUD-007**: Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` at every task or batch gate; database changes additionally require a green CI-hosted migration/integration workflow run, `npm run db:lint`, generated-type review, Supabase advisors, and the workflow run URL recorded as evidence.
- **PAT-001**: Use the boundary flow `entry point → validation/authentication → domain service → typed data/provider adapter → safe result`.
- **PAT-002**: Begin privileged data, service, provider, and admin-client modules with `import "server-only"`.
- **PAT-003**: Use typed `AppError` and `ProviderError` internally and map them to stable, buyer-safe responses only at entry points.
- **PAT-004**: Develop critical paths test-first: write failing behavioral tests, implement the minimum production behavior, then refactor while tests remain green.
- **PAT-005**: Use migration ordering of types, tables, constraints/indexes, triggers, RLS, grants/policies, transactional functions, Storage configuration, then generated TypeScript types.
- **PAT-006**: Use semantic CSS tokens and reusable domain components; do not create page-local color systems or hand-roll an available ReUI component.
- **PAT-007**: Use deterministic synthetic identities, products, orders, callback fixtures, UUIDs, and fixed time in automated tests.
- **PAT-008**: Use forward-fix migrations and narrow operator recovery operations that preserve status history and payment evidence.
- **PAT-009**: Revalidate affected Next.js paths or cache tags after product, settings, order, and webhook-driven stock mutations.

## 2. Implementation Steps

### Implementation Phase 1 — Foundation Remediation

- GOAL-001: Preserve the completed seller/Auth foundation and remediate its testing, provisioning, security, configuration, and visual-token gaps before adding commerce tables.

The initial schema remains limited to Auth and `sellers` throughout this phase. Completed foundation tasks are recorded first. `TASK-007A` records the agreed CI test strategy without creating CI configuration. Execute the future `TASK-007B` workflow implementation sequentially after `TASK-007A`. After `TASK-007B`, run parallel batch 1A: `TASK-008`, `TASK-009`, and `TASK-010`. Execute `TASK-011` only after the batch. Shared-file serialization applies: `TASK-007B` owns `.github/workflows/`, `package.json`, and the lockfile; `TASK-009` owns `src/app/globals.css`; no parallel task may edit those files.

- [x] TASK-001 — Application scaffold
- [x] TASK-002 — Supabase SSR clients
- [x] TASK-003 — Seller schema and RLS
- [x] TASK-004 — Admin authentication guards
- [x] TASK-005 — Foundation test baseline
- [x] TASK-006 — Auth scope deferral
- [x] TASK-007A — CI integration strategy specification
- [x] TASK-007B — CI integration workflow implementation
- [x] TASK-008 — CI test admin provisioning
- [ ] TASK-009 — Tokonic design tokens
- [ ] TASK-010 — Login rate limiting
- [ ] TASK-011 — Runtime seller RLS

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Dependencies: none. Files/areas: existing Next.js scaffold, `package.json`, `tsconfig.json`, `src/app/`, Tailwind/PostCSS configuration, `components.json`. Done criteria: strict TypeScript Next.js App Router application, Tailwind, shadcn-compatible primitives, and Heroicons are installed and the baseline validation commands pass. Test-first critical path: no, foundation composition. Parallel safety: completed historical task; no execution required. | ✅ | 2026-07-22 |
| TASK-002 | Dependencies: TASK-001. Files/areas: `src/lib/supabase/browser.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/proxy.ts`, `src/proxy.ts`, `src/lib/env/public.ts`, `.env.example`. Done criteria: browser/server SSR clients use only publishable browser configuration, proxy cookies are preserved, and no privileged client or secret browser import exists. Test-first critical path: no, verified by build and security review. Parallel safety: completed historical task; no execution required. | ✅ | 2026-07-22 |
| TASK-003 | Dependencies: TASK-002. Files/areas: existing `supabase/migrations/*create_sellers*.sql`, seller hardening migrations, `supabase/seed.sql`, `src/lib/supabase/database.types.ts`. Done criteria: the sole application table is `sellers`, its Auth linkage and ownership RLS exist, types are generated, and the SQL contract test passes. Test-first critical path: yes, existing static migration contract test. Parallel safety: completed historical schema task; no execution required. | ✅ | 2026-07-22 |
| TASK-004 | Dependencies: TASK-003. Files/areas: `src/lib/validation/auth.ts`, `src/actions/auth.ts`, `src/lib/auth/require-admin.ts`, `src/server/data/seller.ts`, admin login and protected layout pages. Done criteria: generic login, secure logout, protected layout, seller linkage, and independent `requireAdmin()` checks are implemented without public signup. Test-first critical path: yes, auth validation unit coverage exists. Parallel safety: completed historical task; no execution required. | ✅ | 2026-07-22 |
| TASK-005 | Dependencies: TASK-004. Files/areas: `tests/unit/auth-validation.test.ts`, `tests/unit/seller-migration.test.ts`, existing lint/typecheck/build setup. Done criteria: baseline tests cover login schema and static seller migration ownership contract and all validation commands pass. Test-first critical path: yes, baseline security contracts. Parallel safety: completed historical task; no execution required. | ✅ | 2026-07-22 |
| TASK-006 | Dependencies: TASK-005. Files/areas: operator decision record in this plan, existing auth routes, `src/actions/auth.ts`. Done criteria: password recovery, reset-password page, and `/auth/callback` are absent from Phase 1–6 task scope; login/logout remain functional; no dead recovery link is rendered; the deferral is recorded in release exceptions. Test-first critical path: no. Parallel safety: sequential policy gate; do not combine with auth feature expansion. | ✅ | 2026-07-23 |
| TASK-007A | Dependencies: TASK-006. Files/areas: `implementation-plan.md`, `tokonic-technical-design-document.md`, `docs/testing-guidelines.md`. Done criteria: the CI-only disposable Supabase strategy is documented consistently; the future workflow contract specifies start Supabase CLI services inside a GitHub-hosted runner, replay migrations from empty, seed deterministic synthetic fixtures and Auth identities, run isolated integration suites, always tear down, trigger on every push to every branch, avoid the shared remote project, and record green workflow URLs as database-gate evidence; no workflow or CI configuration is created in this task. Test-first critical path: no, architecture/planning decision. Parallel safety: documentation-only strategy gate. | ✅ | 2026-07-23 |
| TASK-007B | Dependencies: TASK-007A. Files/areas: future `.github/workflows/` integration workflow, `package.json`, package lockfile, Supabase CLI configuration, test configuration, `tests/fixtures/`, integration-test helpers. Done criteria: pinned dependencies and scripts implement the TASK-007A contract; on every push to any branch, GitHub Actions starts a disposable Supabase CLI stack in the runner, applies all migrations from empty, seeds deterministic synthetic fixtures and Auth identities, runs isolated database/Auth/Storage/concurrency integration suites without contacting the shared remote project, tears down even on failure, and produces a green workflow run whose URL is recorded as evidence. The operator's machine requires no Docker. Test-first critical path: yes, prerequisite for runtime security/payment tests. Parallel safety: exclusive shared workflow/dependency/config task; block tasks editing workflow, package, lockfile, or shared test configuration until complete. Evidence: https://github.com/teggar4ar/tokonic/actions/runs/30009307614 (`d8393ad`). | ✅ | 2026-07-23 |
| TASK-008 | Dependencies: TASK-007B. Files/areas: new environment-driven script under `scripts/`, server-only environment parsing used by the script, `.env.example`, `supabase/seed.sql` if sample non-secret catalog-independent data remains necessary. Done criteria: one command reads required synthetic admin email/password and seller fields from CI environment variables, creates or updates the Auth user in the CI-hosted disposable stack, obtains its generated ID at runtime, upserts exactly one linked seller row, is idempotent, rejects the shared remote project and non-CI targets by default, prints no password/token/key, and passes dry-run plus repeated-execution tests in CI with the green workflow run URL recorded. Test-first critical path: yes, validation and repeat execution against CI-hosted disposable Supabase. Parallel safety: safe in batch 1A after TASK-007B if no workflow/package/config edits are made; coordinate `.env.example` ownership. | ✅ | 2026-07-24 |
| TASK-009 | Dependencies: TASK-007B. Files/areas: `src/app/globals.css`, root layout font configuration, shared UI primitives, login presentation. Done criteria: semantic Tokonic colors, spacing, radius, focus, tabular-number, and Figtree typography tokens replace grayscale/Arial defaults; buyer controls support 44px targets; login remains functional without becoming the template for later screens; lint, typecheck, test, and build pass. Test-first critical path: no; perform visual/accessibility checks at 360, 768, 1024, and 1440 px. Parallel safety: safe in batch 1A with exclusive ownership of global styles and root layout. |  |  |
| TASK-010 | Dependencies: TASK-007B. Files/areas: login boundary, reusable rate-limit utility/provider, environment schema, `tests/integration/services/`. Done criteria: reviewed rate limiting protects login, generic failures remain indistinguishable, deterministic tests cover allowed and throttled attempts, and configuration fails closed; remote leaked-password protection is recorded as a deployment checklist action. Test-first critical path: yes, authentication abuse boundary. Parallel safety: safe in batch 1A if it does not edit package/config files; otherwise sequence after TASK-007B and declare file ownership. |  |  |
| TASK-011 | Dependencies: TASK-008, TASK-010. Files/areas: `tests/integration/database/seller-rls.test.ts`, Auth/seller fixtures, `requireAdmin()` integration coverage. Done criteria: the CI-hosted stack replays migrations from empty; runtime tests prove anon cannot read seller data, owner can read/update only its row, unrelated authenticated user reads/mutates zero rows, and protected data access rejects no-session/unrelated users; static SQL assertions are not the sole evidence; the green workflow run URL is recorded. Test-first critical path: yes, RLS isolation. Parallel safety: sequential database acceptance gate using exclusive disposable CI database state. |  |  |

### Implementation Phase 2 — Catalog and Storage

- GOAL-002: Add store settings, products, product images, secure Storage operations, public catalog/detail pages, and the local cart.

Execute `TASK-012` through `TASK-014` sequentially because migrations and generated types conflict. Parallel batch 2A after `TASK-014`: `TASK-015`, `TASK-016`, and `TASK-017`. Execute `TASK-018` after `TASK-015`; execute `TASK-019` after `TASK-016` and `TASK-017`. Run `TASK-020` as the phase gate. `TASK-012` is the first task allowed to expand the seller/Auth-only schema.

- [ ] TASK-012 — Product schema and RLS
- [ ] TASK-013 — Product image Storage
- [ ] TASK-014 — Phase 2 generated types
- [ ] TASK-015 — Store settings
- [ ] TASK-016 — Product services
- [ ] TASK-017 — Persistent local cart
- [ ] TASK-018 — Image upload lifecycle
- [ ] TASK-019 — Catalog and product UI
- [ ] TASK-020 — Catalog phase acceptance

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-012 | Dependencies: TASK-011. Files/areas: one new ordered migration under `supabase/migrations/`. Done criteria: migration creates `products` and `product_images` with UUID keys, seller/product foreign keys, integer/bigint checks, unique seller slug, image order/count-supporting constraints, indexes, updated timestamps, RLS enabled, least-privilege grants, published public reads, and explicit owner predicates; no order/payment tables are added. Test-first critical path: yes, write migration/database tests for constraints and owner isolation first. Parallel safety: exclusive migration task; no concurrent migration work. |  |  |
| TASK-013 | Dependencies: TASK-012. Files/areas: one new ordered Storage migration, `supabase/config.toml`, Storage integration fixtures. Done criteria: public `product-images` bucket enforces JPEG/PNG/WebP and 2 MB, authenticated write/delete policies validate `products/{owned_product_id}/{uuid}.{ext}`, public reads are limited to intended objects, and SVG/upsert/unowned paths fail. Test-first critical path: yes, Storage ownership and validation. Parallel safety: exclusive migration/config task; sequence after TASK-012. |  |  |
| TASK-014 | Dependencies: TASK-013. Files/areas: `src/lib/supabase/database.types.ts`, database generation scripts only if correction is required. Done criteria: the CI-hosted migrations replay cleanly from empty and its green workflow run URL is recorded, `npm run db:lint` passes, Supabase security/performance advisors are reviewed, generated types exactly reflect the Phase 2 schema, and no manual generated-type edits exist. Test-first critical path: no; generated artifact gate. Parallel safety: exclusive generated-types task; blocks TypeScript tasks that consume new tables. |  |  |
| TASK-015 | Dependencies: TASK-014. Files/areas: `src/lib/validation/settings.ts`, `src/server/data/seller.ts`, `src/actions/settings.ts`, `src/app/admin/pengaturan/page.tsx`, settings form components. Done criteria: authenticated admin can validate and update store name, logo metadata, WhatsApp phone, origin address/label/ID/level, and timezone; mutation independently calls `requireAdmin()`, uses seller ownership, maps safe errors, and revalidates storefront settings. Test-first critical path: yes for validation and unauthorized mutation cases. Parallel safety: safe in batch 2A with exclusive ownership of settings files. |  |  |
| TASK-016 | Dependencies: TASK-014. Files/areas: `src/lib/validation/products.ts`, `src/server/data/products.ts`, `src/server/services/product-service.ts`, `src/actions/products.ts`, product unit/service tests. Done criteria: create/update/unpublish/hard-delete services validate integers and ownership, preserve referenced products by unpublishing, permit hard deletion only when unreferenced, expose no raw errors, and revalidate affected routes. Test-first critical path: yes for ownership, integer constraints, and historical-delete rule. Parallel safety: safe in batch 2A with exclusive ownership of product domain files. |  |  |
| TASK-017 | Dependencies: TASK-014. Files/areas: cart types, `src/lib/money.ts`, cart validation schema, `src/contexts/cart-context.tsx`, cart components, cart page, unit tests. Done criteria: versioned `tokonic_cart_v1` state persists only IDs/quantities, malformed entries are removed, duplicates merge, quantities remain positive and bounded, subtotal display uses current hydrated product data and exact rupiah formatting, and add/remove/change flows work across refresh. Test-first critical path: yes for local-state sanitization and integer money helpers. Parallel safety: safe in batch 2A; no database/global config edits. |  |  |
| TASK-018 | Dependencies: TASK-015. Files/areas: image helper, compression/upload Client Component, product image service/action, Storage API calls, image integration tests. Done criteria: images are decoded/compressed with the specified limits, actual MIME and final size are revalidated, count never exceeds five, paths use generated UUIDs, metadata insertion verifies ownership/path, failed inserts attempt orphan cleanup, deletion preserves DB rows on non-not-found Storage failure, and replacements avoid upsert. Test-first critical path: yes for MIME, size, count, path, ownership, and cleanup behavior. Parallel safety: safe after TASK-015 but coordinate product service imports with TASK-016 completion. |  |  |
| TASK-019 | Dependencies: TASK-016, TASK-017. Files/areas: ReUI Data Grid installation/configuration, admin product routes/forms, public storefront route group, product detail route, storefront/shared components. Done criteria: admin can list/create/edit/unpublish/delete products with loading/empty/error states; public pages show only published products, fallback images, current price/stock, unavailable states, gallery, quantity action, and safe WhatsApp product context; UI follows mobile-first tokens and real ReUI APIs. Test-first critical path: no for standard composition; service behavior is already automated. Parallel safety: sequential UI integration because admin/public pages share product components and any ReUI/package install is exclusive. |  |  |
| TASK-020 | Dependencies: TASK-018, TASK-019. Files/areas: Phase 2 database, Storage, product, settings, cart, responsive, and accessibility suites/checklists. Done criteria: product/storage ownership tests pass in the CI-hosted disposable stack; image limits and cleanup pass; historical product behavior passes; seller can publish a product; buyer can browse/detail/add it to a persistent valid cart; validation commands, CI migration replay, database lint, advisors, and manual mobile/keyboard checks pass; the green workflow run URL is recorded. Test-first critical path: yes for all listed security/data invariants. Parallel safety: sequential phase acceptance gate. |  |  |

### Implementation Phase 3 — Shipping and Checkout

- GOAL-003: Integrate RajaOngkir and create authoritative pending orders with immutable item and shipping snapshots.

Execute `TASK-021` before other phase tasks because it owns package/config and provider-contract decisions. Execute `TASK-022` and `TASK-023` in parallel batch 3A. Execute `TASK-024` and `TASK-025` sequentially because they own migrations and generated types. Parallel batch 3B after `TASK-025`: `TASK-026` and `TASK-027`. Finish with `TASK-028`.

- [ ] TASK-021 — RajaOngkir contract verification
- [ ] TASK-022 — RajaOngkir adapters
- [ ] TASK-023 — Checkout domain helpers
- [ ] TASK-024 — Order schema and RLS
- [ ] TASK-025 — Phase 3 generated types
- [ ] TASK-026 — Shipping API routes
- [ ] TASK-027 — Checkout service
- [ ] TASK-028 — Checkout UI and acceptance

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-021 | Dependencies: TASK-020. Files/areas: current RajaOngkir official documentation notes, server environment schema, `.env.example`, rate-limit configuration, package/config files only if required. Done criteria: exact V2 destination/cost endpoints, request fields, enabled couriers, quota behavior, response shapes, and allowed host are recorded in code-facing provider schemas/config; server-only variables fail fast; no credential becomes public. Test-first critical path: no, implementation-blocking contract verification. Parallel safety: exclusive dependency/config task. |  |  |
| TASK-022 | Dependencies: TASK-021. Files/areas: `src/server/providers/rajaongkir/client.ts`, `schemas.ts`, `mapper.ts`, normalized provider types, sanitized fixtures, unit tests. Done criteria: destination and rate adapters validate official-shaped fixtures, map normalized results, reject malformed/negative costs, enforce host and timeout, and throw sanitized `ProviderError` without leaking credentials. Test-first critical path: yes, provider boundary fixtures written first. Parallel safety: safe in batch 3A with exclusive provider-directory ownership. |  |  |
| TASK-023 | Dependencies: TASK-021. Files/areas: `src/lib/phone.ts`, `src/lib/order-code.ts`, `src/lib/money.ts`, `src/lib/validation/checkout.ts`, checkout domain types, unit tests. Done criteria: phone normalization, random non-sequential order-code validation/generation, cart deduplication, bounded buyer/address/destination fields, UUID submission key, integer subtotal/weight/total helpers, and invalid input cases pass deterministic tests. Test-first critical path: yes, money and lookup identity helpers. Parallel safety: safe in batch 3A with exclusive shared-helper ownership. |  |  |
| TASK-024 | Dependencies: TASK-022, TASK-023. Files/areas: one new ordered migration under `supabase/migrations/`, database integration tests. Done criteria: migration creates order enums, `orders`, `order_items`, and initial `order_status_history` with snapshot columns, bigint/integer checks, total equality, unique random order code, unique seller submission key, indexes, RLS, owner policies, narrow grants, and no payment event/function yet. Test-first critical path: yes for constraints, snapshots, RLS, and duplicate submission uniqueness. Parallel safety: exclusive migration task. |  |  |
| TASK-025 | Dependencies: TASK-024. Files/areas: generated `src/lib/supabase/database.types.ts`, migration replay and advisors. Done criteria: CI-hosted empty replay, database lint, advisors, and integration tests pass; generated types contain Phase 3 entities and are reviewed; the green workflow run URL is recorded. Test-first critical path: no, generated artifact gate. Parallel safety: exclusive generated-types task. |  |  |
| TASK-026 | Dependencies: TASK-025. Files/areas: shipping API route handlers, shared rate-limit utility, provider service, route/service integration tests. Done criteria: destination GET and rates POST routes validate content/query/body bounds, enforce rate limits, calculate weight from current server products, call RajaOngkir through normalized adapters, and return stable safe results/errors without accepting client prices or URLs. Test-first critical path: yes for tampering, malformed provider output, timeout, and throttling. Parallel safety: safe in batch 3B with exclusive shipping route/service ownership. |  |  |
| TASK-027 | Dependencies: TASK-025. Files/areas: `src/server/data/orders.ts`, `src/server/services/checkout-service.ts`, checkout persistence function/migration if transaction support is required, checkout service tests. Done criteria: service re-fetches published products in one query, rejects unavailable/insufficient items, calculates integer totals/weight, re-fetches the selected shipping rate, inserts order and item snapshots atomically, returns existing order for identical submission replay, returns `CONFLICT` for changed replay, and never decrements stock. Test-first critical path: yes for tampered totals, duplicate submission, snapshots, atomic creation, and no stock reservation. Parallel safety: conditionally safe in batch 3B only if no migration is needed; if a migration is required, serialize migration → types before implementation. |  |  |
| TASK-028 | Dependencies: TASK-026, TASK-027. Files/areas: checkout page/form, destination autocomplete, rate selector, order summary, loading/error states, integration and manual tests. Done criteria: buyer enters validated fulfillment data, selects a normalized destination/rate, sees current totals, must accept changed rates, cannot double-submit, retains recoverable form/cart state, and creates exactly one pending order with snapshots; validation commands and live controlled RajaOngkir smoke tests pass. Test-first critical path: yes for service/route integrity; UI composition is manually verified. Parallel safety: sequential phase integration gate. |  |  |

### Implementation Phase 4 — Payments and Inventory

- GOAL-004: Create Duitku invoices and process callbacks transactionally with idempotent payment evidence and atomic non-negative inventory.

Execute `TASK-029` first as the provider-contract/config gate. Parallel batch 4A: `TASK-030` and `TASK-031`. Execute `TASK-032`, `TASK-033`, and `TASK-034` sequentially because they own migrations, transactional SQL, and generated types. Parallel batch 4B after `TASK-034`: `TASK-035` and `TASK-036`. Finish with `TASK-037`.

- [ ] TASK-029 — Duitku contract verification
- [ ] TASK-030 — Duitku adapters
- [ ] TASK-031 — Payment domain contracts
- [ ] TASK-032 — Payment events schema
- [ ] TASK-033 — Atomic payment inventory
- [ ] TASK-034 — Payment database gate
- [ ] TASK-035 — Payment creation
- [ ] TASK-036 — Payment callback
- [ ] TASK-037 — Payment phase acceptance

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-029 | Dependencies: TASK-028. Files/areas: current Duitku POP official documentation notes, server environment schema, `.env.example`, package/config files only if necessary. Done criteria: exact sandbox endpoints, request fields, signatures, callback body, acknowledgment, result mapping, expiration behavior, and enabled methods are recorded in provider schemas/tests; decision is recorded for Route Handler payment creation and expiration reconciliation fallback; secrets fail fast and remain server-only. Test-first critical path: no, implementation-blocking contract verification. Parallel safety: exclusive dependency/config task. |  |  |
| TASK-030 | Dependencies: TASK-029. Files/areas: `src/server/providers/duitku/client.ts`, `signatures.ts`, `schemas.ts`, `mapper.ts`, official/sanitized fixtures, unit tests. Done criteria: request mapping, signing, callback verification, secure comparison, status normalization, timeout, and safe errors conform to current official fixtures; malformed or mismatched data fails closed. Test-first critical path: yes, provider signature and mapping tests precede code. Parallel safety: safe in batch 4A with exclusive provider-directory ownership. |  |  |
| TASK-031 | Dependencies: TASK-029. Files/areas: payment validation schema, payment domain types, sanitized logging/error contracts, unit tests. Done criteria: merchant order, reference, result, amount, event-key, expiration, and callback input contracts are bounded and deterministic; raw callbacks, secrets, and PII cannot enter public errors or structured logs. Test-first critical path: yes for callback normalization and event-key determinism. Parallel safety: safe in batch 4A with exclusive payment-domain helper ownership. |  |  |
| TASK-032 | Dependencies: TASK-030, TASK-031. Files/areas: one new ordered migration. Done criteria: migration adds required Duitku/payment fields to orders and creates `payment_events` with unique deterministic event key, sanitized payload, processing outcomes, indexes, RLS, revoked anonymous/authenticated writes, and privileged-only mutation grants. Test-first critical path: yes for uniqueness, access denial, and persisted evidence constraints. Parallel safety: exclusive migration task. |  |  |
| TASK-033 | Dependencies: TASK-032. Files/areas: one new ordered transactional-function migration and `tests/integration/database/payment-inventory.test.ts`. Done criteria: failing tests are written first for replay, concurrent success, atomic multi-product decrement, insufficient stock, expiration, and mismatches; function locks order/products deterministically, inserts event once, conditionally decrements all stock, rolls back partial changes, transitions to `paid`, `cancelled`, or `payment_review`, appends history, and has safe grants/search path. Test-first critical path: yes, mandatory payment webhook idempotency and atomic stock coverage. Parallel safety: exclusive migration/database-concurrency task; no parallel database tests. |  |  |
| TASK-034 | Dependencies: TASK-033. Files/areas: generated database types, CI-hosted replay, database lint, advisors. Done criteria: the CI-hosted disposable stack replays all migrations from empty, payment/inventory concurrency suites pass repeatedly, advisors have no unresolved critical finding, generated types reflect payment schema/function results, and the green workflow run URL is recorded. Test-first critical path: yes, database critical-path acceptance. Parallel safety: exclusive generated-types and database gate. |  |  |
| TASK-035 | Dependencies: TASK-034. Files/areas: payment data module, `src/server/services/payment-service.ts`, payment creation route, checkout/payment browser integration, service tests. Done criteria: payment creation loads persisted server total, creates one active Duitku invoice, persists reference/URL/expiry, safely handles provider failure, prevents uncontrolled duplicate invoices, and returns only safe POP initiation data; browser return cannot mutate status. Test-first critical path: yes for persisted total, duplicate submission, and provider failure. Parallel safety: safe in batch 4B with exclusive creation-route/service ownership. |  |  |
| TASK-036 | Dependencies: TASK-034. Files/areas: Duitku callback route, callback service, privileged Supabase client, structured event logging, route/service tests. Done criteria: route reads body once, validates and verifies signature/merchant/reference/amount before mutation, invokes only the atomic function, acknowledges valid duplicate callbacks correctly, rejects invalid/unknown callbacks without effects, never caches, and logs only sanitized identifiers/outcomes. Test-first critical path: yes for invalid signature, amount, merchant/reference mismatch, unknown order, replay, and concurrent callbacks. Parallel safety: safe in batch 4B with exclusive callback-route/service ownership. |  |  |
| TASK-037 | Dependencies: TASK-035, TASK-036. Files/areas: expiration reconciliation action/job chosen in TASK-029, payment outcome UI, admin review visibility, sandbox/manual fixtures. Done criteria: pending expiration reaches cancelled without stock change; successful sandbox callback decrements stock once; duplicate callback changes nothing; insufficient inventory preserves paid evidence in `payment_review`; browser redirect has no authority; all automated, validation, migration, advisor, and controlled Duitku sandbox checks pass. Test-first critical path: yes for all payment/inventory outcomes. Parallel safety: sequential phase acceptance gate. |  |  |

### Implementation Phase 5 — Fulfillment and Reporting

- GOAL-005: Provide secure seller order operations, authoritative transitions/history, guest tracking, WhatsApp confirmation, and reconciliable summaries.

Execute `TASK-038` before dependent order features. Parallel batch 5A: `TASK-039`, `TASK-040`, and `TASK-041`. Execute `TASK-042` after `TASK-039`, then finish with `TASK-043`. Any SQL function or index migration discovered in `TASK-038` or `TASK-041` must be serialized before generated types and dependent UI.

- [ ] TASK-038 — Order transition enforcement
- [ ] TASK-039 — Admin order management
- [ ] TASK-040 — Guest order lookup
- [ ] TASK-041 — Sales reporting
- [ ] TASK-042 — WhatsApp confirmation
- [ ] TASK-043 — Fulfillment phase acceptance

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-038 | Dependencies: TASK-037. Files/areas: pure transition validator, order validation schema, authoritative order transition function/migration, order service, unit/database tests. Done criteria: test-first suites accept only documented transitions, require tracking for shipment, restrict normal `paid`/`packed` cancellation, require refund completion for review cancellation, independently authorize admin mutations, record every transition with source/actor/reason, and reject skipped/backward states in both TypeScript and database. Test-first critical path: yes, mandatory order-transition coverage. Parallel safety: exclusive migration/types task if SQL changes are required; complete before batch 5A. |  |  |
| TASK-039 | Dependencies: TASK-038. Files/areas: admin order data queries, ReUI Data Grid order list, order detail, timeline/history, fulfillment forms/actions. Done criteria: ownership-scoped paginated/filterable list and detail expose buyer fulfillment data only to admin; actions show only valid transitions; paid, packed, shipped, completed, cancelled, and review states are accessible and responsive; tracking becomes required and persisted on shipment. Test-first critical path: yes for authorization and transition service boundaries; UI composition manually verified. Parallel safety: safe in batch 5A with exclusive admin-order files. |  |  |
| TASK-040 | Dependencies: TASK-038. Files/areas: order lookup schema, phone normalization reuse, privileged narrow lookup data module/service, `/api/orders/lookup`, public lookup/status UI, service tests. Done criteria: both code and normalized phone are required in one query; wrong code, wrong phone, missing, and anonymized cases return the same status/body; successful response contains only approved snapshots/status/shipping/tracking fields; phone never appears in URL; endpoint is rate-limited and logs no raw credentials. Test-first critical path: yes, mandatory guest lookup authorization and non-disclosure coverage. Parallel safety: safe in batch 5A with exclusive lookup files. |  |  |
| TASK-041 | Dependencies: TASK-038. Files/areas: reports data module, optional parameterized summary SQL migration, admin dashboard summary components, reporting tests. Done criteria: daily/monthly counts and gross paid totals use seller timezone defaulting to `Asia/Jakarta`; pending/failed/expired/unpaid orders are excluded; refund-pending/refunded totals are separate; actionable `paid`, `packed`, and `payment_review` counts reconcile with seeded orders; empty periods show zero. Test-first critical path: yes for financial aggregation boundaries. Parallel safety: safe in batch 5A only if no migration is needed; otherwise serialize migration and regenerated types before UI. |  |  |
| TASK-042 | Dependencies: TASK-039. Files/areas: buyer payment/order outcome components, seller setting query, WhatsApp URL helper, unit tests. Done criteria: post-payment buyer action targets the configured seller number, includes only safe order context, safely encodes text, contains no payment secret or unnecessary PII, and cannot mutate payment/order status. Test-first critical path: yes for safe URL/context generation. Parallel safety: safe after order outcome view exists; no shared config edits. |  |  |
| TASK-043 | Dependencies: TASK-039, TASK-040, TASK-041, TASK-042. Files/areas: Phase 5 automated suites and manual fulfillment checklist. Done criteria: one sandbox order progresses through paid, packed, shipped with tracking, guest-visible tracking, and completed; invalid transitions fail and history remains complete; guest lookup mismatch cases are indistinguishable; summaries reconcile; all validation commands pass. Test-first critical path: yes for transitions, history, guest lookup, and reporting calculations. Parallel safety: sequential phase acceptance gate. |  |  |

### Implementation Phase 6 — Privacy and Hardening

- GOAL-006: Implement retention/privacy behavior, complete security and quality verification, document recovery/deployment procedures, and satisfy MVP release acceptance.

Parallel batch 6A after Phase 5: `TASK-044`, `TASK-045`, and `TASK-046`. Execute `TASK-047` after `TASK-045`. Parallel batch 6B: `TASK-048` and `TASK-049`. Finish sequentially with `TASK-050`. Documentation tasks must coordinate ownership of existing documentation; no new multi-seller or password-recovery implementation may enter this phase.

- [ ] TASK-044 — Privacy notice
- [ ] TASK-045 — Data retention
- [ ] TASK-046 — UI and accessibility hardening
- [ ] TASK-047 — Complete RLS matrix
- [ ] TASK-048 — Recovery and deployment docs
- [ ] TASK-049 — Manual E2E evidence
- [ ] TASK-050 — Final release gate

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-044 | Dependencies: TASK-043. Files/areas: `/privacy` page, storefront footer, checkout privacy link, static privacy copy. Done criteria: public Bahasa Indonesia notice explains collected buyer data, purposes, admin/operator access, one-year retention, anonymization, lookup termination, and review-before-commercial-launch; links are visible from storefront and checkout and pass accessibility/responsive checks. Test-first critical path: no, static product/legal copy reviewed against PRD. Parallel safety: safe in batch 6A with exclusive privacy/footer files. |  |  |
| TASK-045 | Dependencies: TASK-043. Files/areas: retention eligibility helper, retention service, protected/manual operator command or function migration, database tests. Done criteria: failing tests precede implementation; only completed/cancelled orders older than one year are anonymized; name, phone, phone hash, address, and unnecessary payload PII are removed; transaction/reporting data remains; repeated execution is idempotent; counts/errors omit PII; guest lookup stops working. Test-first critical path: yes for privacy retention and idempotency. Parallel safety: safe in batch 6A only if no migration conflicts exist; any migration and generated types must run exclusively. |  |  |
| TASK-046 | Dependencies: TASK-043. Files/areas: shared loading/error/not-found states, admin/storefront responsive polish, accessibility checks, performance/image review. Done criteria: core pages have required loading/empty/error/success states, 360px has no page overflow, admin remains usable on mobile, keyboard/focus/labels/contrast/status semantics pass, reduced motion is respected, images reserve dimensions, and controlled Lighthouse targets are recorded. Test-first critical path: no; automated accessibility tooling may supplement manual review. Parallel safety: safe in batch 6A if file ownership is partitioned and global styles/package files are not concurrently edited. |  |  |
| TASK-047 | Dependencies: TASK-045. Files/areas: full runtime RLS matrix and grants tests for sellers, products, images, orders, items, history, payment events, Storage, functions, privileged webhook, and guest lookup. Done criteria: anon receives only intended published storefront data; owner accesses only owned records; unrelated authenticated user reads/mutates zero protected rows; direct anonymous order access fails; transactional functions reject unintended roles; service-role use remains narrow; all tests run against the CI-hosted disposable Supabase stack, never local Docker or the shared remote project, and the green workflow run URL is recorded. Test-first critical path: yes, final mandatory RLS isolation coverage. Parallel safety: sequential database security gate with exclusive database state. |  |  |
| TASK-048 | Dependencies: TASK-044, TASK-046, TASK-047. Files/areas: existing product/TDD/guideline checklists and operator recovery/deployment documentation locations. Done criteria: procedures cover missing callbacks, duplicate callbacks, `payment_review`, manual refunds, expiration reconciliation, Storage orphans, RajaOngkir outage, Supabase pause, Auth account recovery, forward-fix migration rollback, environment setup, operator provisioning, deployment order, and password-recovery deferral; no secrets or generated IDs are documented. Test-first critical path: no, operational review. Parallel safety: safe in batch 6B with exclusive documentation ownership. |  |  |
| TASK-049 | Dependencies: TASK-044, TASK-046, TASK-047. Files/areas: manual E2E evidence and release checklist. Done criteria: dated evidence records environment, synthetic fixture/order code, expected and actual results for login/logout, unauthorized navigation, product/image limits, cart recovery, RajaOngkir success/failure, Duitku success/duplicate/invalid/expired/review, competing checkout inventory, fulfillment/tracking, guest mismatch, privacy/retention, responsive widths, keyboard flow, and enabled leaked-password protection. Test-first critical path: no, manual complement to automated critical suites. Parallel safety: safe in batch 6B; use isolated synthetic data and avoid concurrent mutation of the same order. |  |  |
| TASK-050 | Dependencies: TASK-048, TASK-049. Files/areas: complete repository, migrations, generated types, test suites, release checklist. Done criteria: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, a green CI-hosted migration/integration workflow run with its URL recorded, `npm run db:lint`, stale-type check, security/performance advisors, controlled RajaOngkir smoke test, and Duitku sandbox flow pass; no critical total, stock, auth, RLS, payment, or PII defect remains; completed/deferred scope matches this plan and no multi-seller work exists. Test-first critical path: yes, aggregate critical-path release gate. Parallel safety: final sequential blocking task; no concurrent repository edits. |  |  |

## 3. Alternatives

- **ALT-001**: Provision the administrator manually through the Supabase dashboard. Rejected because it is not reproducible, encourages undocumented generated-ID handling, and cannot safely recreate local development state.
- **ALT-002**: Store a fixed Auth user UUID in `supabase/seed.sql`. Rejected because generated IDs must not be assumed and credentials/identity linkage must remain environment-driven.
- **ALT-003**: Add password recovery and the Auth callback route during remediation. Deferred to keep the agreed Phase 1 disposition and avoid expanding authentication scope before core commerce completion.
- **ALT-004**: Create all commerce tables in the initial schema. Rejected because the agreed initial disposition keeps only seller/Auth; each later domain receives an ordered, reviewable migration.
- **ALT-005**: Build a multi-tenant SaaS with public seller signup and subscriptions. Rejected because the current validation target is one operator-owned store.
- **ALT-006**: Reserve inventory at checkout or pending payment. Rejected because stale reservations increase operational complexity and violate the selected inventory model.
- **ALT-007**: Decrement stock in TypeScript through multiple Supabase calls. Rejected because replay and partial failure could corrupt inventory; one PostgreSQL transaction is required.
- **ALT-008**: Trust browser redirects as payment confirmation. Rejected because redirects are buyer-controlled feedback rather than authoritative provider evidence.
- **ALT-009**: Use a Duitku SDK. Rejected because direct REST integration with current official contracts avoids an unmaintained or mismatched SDK.
- **ALT-010**: Expose anonymous order-table reads through RLS for guest tracking. Rejected because lookup requires two credentials and a narrow privileged server query.
- **ALT-011**: Store cart names, prices, and totals as authoritative browser state. Rejected because catalog state may change and checkout must use fresh server data.
- **ALT-012**: Use mocked Supabase clients as proof of RLS and transaction behavior. Rejected because authorization, constraints, grants, replay, and concurrency require disposable real PostgreSQL/Supabase integration tests.
- **ALT-013**: Automatically refund and restore stock for exceptional paid orders. Rejected because refunds and item sellability remain manual MVP decisions.
- **ALT-014**: Introduce scheduled retention infrastructure immediately. Rejected for the low-traffic demo; a protected idempotent manual operation is sufficient until commercial readiness.

## 4. Dependencies

- **DEP-001**: Node.js `>=22.0.0 <23.0.0`, npm, and the pinned dependencies/scripts in `package.json`.
- **DEP-002**: GitHub Actions hosted runners with Docker support and a pinned Supabase CLI capable of starting a disposable Auth, PostgreSQL, RLS, and Storage test stack entirely inside CI; no operator-local Docker dependency.
- **DEP-003**: One operator-controlled Supabase project with public signup disabled and leaked-password protection enabled before public demo exposure.
- **DEP-004**: Environment-provided synthetic CI admin credentials and seller/store fields used only by the provisioning script against the disposable CI stack.
- **DEP-005**: RajaOngkir API V2 account, API key, enabled couriers, current endpoint documentation, quota information, and controlled live smoke-test access.
- **DEP-006**: Duitku POP sandbox account, merchant code, API key, enabled payment methods, callback/return configuration, and current official integration documentation.
- **DEP-007**: Vercel preview/demo environment and operator-controlled environment variables, domain, DNS, callback URL, and Auth redirect configuration.
- **DEP-008**: ReUI registry access for documented Data Grid, Autocomplete, Frame, Badge, Alert, Timeline, Number Field, and other selected reusable components.
- **DEP-009**: `browser-image-compression` or the approved pinned image preprocessing dependency before upload implementation.
- **DEP-010**: Synthetic test identities, provider fixtures, products, orders, timestamps, and concurrency data containing no operator credentials or real buyer information.
- **DEP-011**: Seller origin address/identifier, WhatsApp number, timezone, product weights, and courier configuration needed for checkout.
- **DEP-012**: Sequential ownership of migrations, generated types, `package.json`, lockfile, shared test/config files, `.env.example`, and `globals.css`.

## 5. Files

- **FILE-001**: `package.json`, lockfile, and the future `.github/workflows/` integration workflow — pinned dependencies plus development, validation, database, and CI integration-test commands.
- **FILE-002**: `.env.example` and environment schema modules — value-free public/server configuration contracts.
- **FILE-003**: `scripts/` — environment-driven synthetic CI admin provisioning and approved operator maintenance commands.
- **FILE-004**: `supabase/config.toml`, `supabase/seed.sql`, and `supabase/migrations/` — ordered schema, RLS, grants, functions, Storage, and deterministic non-secret seed definitions.
- **FILE-005**: `src/lib/supabase/database.types.ts` — generated Supabase database definitions after every migration.
- **FILE-006**: `src/lib/supabase/` and `src/lib/auth/` — browser/server/privileged clients, proxy integration, and secure admin guard.
- **FILE-007**: `src/lib/validation/` — shared auth, settings, products, checkout, payment, and order schemas.
- **FILE-008**: `src/lib/money.ts`, `src/lib/phone.ts`, `src/lib/order-code.ts`, and `src/lib/image.ts` — deterministic critical helpers.
- **FILE-009**: `src/server/data/` — typed, server-only seller, product, order, payment, lookup, and reporting queries.
- **FILE-010**: `src/server/services/` — product, checkout, payment, order, lookup, reporting, and retention workflows.
- **FILE-011**: `src/server/providers/rajaongkir/` and `src/server/providers/duitku/` — server-only clients, schemas, signatures, mappers, timeouts, and normalized errors.
- **FILE-012**: `src/server/errors/` and `src/types/` — stable application/provider errors and safe domain/view contracts.
- **FILE-013**: `src/actions/` — thin authenticated login/logout, settings, product, order, and retention entry points.
- **FILE-014**: `src/app/api/` — shipping, payment creation/callback, and guest lookup Route Handlers.
- **FILE-015**: `src/app/(storefront)/` — catalog, product detail, cart, checkout, order lookup/status, and privacy pages.
- **FILE-016**: `src/app/admin/` or current protected admin route group — dashboard, products, orders, settings, and fulfillment pages.
- **FILE-017**: `src/components/ui/`, `src/components/reui/`, `src/components/storefront/`, `src/components/admin/`, `src/components/cart/`, `src/components/forms/`, and `src/components/shared/` — reusable primitives and typed domain UI.
- **FILE-018**: `src/contexts/cart-context.tsx` and cart domain types — validated browser-local cart persistence.
- **FILE-019**: `src/app/globals.css` and root layout — semantic Tokonic tokens, typography, focus, and page foundations.
- **FILE-020**: `tests/unit/`, `tests/integration/database/`, `tests/integration/services/`, and `tests/fixtures/` — deterministic automated evidence; database suites execute in GitHub Actions rather than on the operator's machine.
- **FILE-021**: `tokonic-prd.md`, `tokonic-technical-design-document.md`, and `docs/` guidelines — authoritative requirements, technical design, checklists, recovery notes, and release evidence.

## 6. Testing

- **TEST-001**: In GitHub Actions, replay all migrations against an empty CI-hosted disposable Supabase database and verify constraints, indexes, grants, triggers, functions, RLS, and Storage setup; record the green workflow run URL as evidence.
- **TEST-002**: Runtime RLS matrix proves anon, owner, unrelated authenticated user, and privileged webhook behavior for every applicable table and function.
- **TEST-003**: `requireAdmin()` and protected data/service operations reject missing sessions and unrelated users and permit only the linked seller.
- **TEST-004**: CI test admin provisioning validates required environment input, refuses the shared remote project and unintended targets, links the generated Auth ID, is idempotent, leaks no credentials, and passes in the disposable CI stack.
- **TEST-005**: Product/image tests cover integer constraints, ownership, publication visibility, historical references, MIME, decoded type, 2 MB size, five-image count, UUID path, deletion, and orphan cleanup.
- **TEST-006**: Cart tests cover malformed JSON, invalid versions, duplicate products, invalid quantities, persistence, and non-authoritative display data.
- **TEST-007**: Integer commerce tests cover subtotal, total weight, shipping, grand total, and exact rupiah behavior without floating point.
- **TEST-008**: RajaOngkir tests cover valid destination/rate fixtures, malformed output, negative costs, timeout, provider failure, host restrictions, and safe errors.
- **TEST-009**: Checkout tests reject tampered prices, shipping costs, weights, unpublished products, insufficient stock, duplicate product IDs, and changed shipping quotes.
- **TEST-010**: Duplicate submission tests return the same matching pending order or `CONFLICT` for changed input and never create a second payable order.
- **TEST-011**: Order snapshot tests prove product updates, unpublishing, and allowed deletion behavior cannot change historical name, price, weight, quantity, or totals.
- **TEST-012**: Duitku tests use current official/sanitized fixtures for request signatures, callback signatures, result mapping, expiration mapping, and acknowledgments.
- **TEST-013**: Callback rejection tests prove invalid signature, amount, merchant identity, reference, unknown order, and malformed body produce no order, event, history, or stock business effect.
- **TEST-014**: Payment webhook idempotency tests replay the same and equivalent successful callbacks and assert one accepted transition, one stock decrement, and preserved duplicate evidence.
- **TEST-015**: Concurrent callback tests issue genuinely overlapping successful operations and assert one accepted paid transition and non-negative final stock.
- **TEST-016**: Atomic stock tests prove a multi-product failure rolls back every decrement and no partial inventory or normal paid transition survives.
- **TEST-017**: Insufficient-stock tests preserve paid evidence, decrement no product, append history, and enter `payment_review`.
- **TEST-018**: Expiration tests cancel only pending unpaid orders and never change stock.
- **TEST-019**: Payment creation tests prove the provider amount comes from the persisted server-calculated order total and redirects cannot establish payment.
- **TEST-020**: Pure order-state tests accept only documented transitions, reject skipped/backward transitions, and require tracking information for shipment.
- **TEST-021**: Authoritative order mutation tests repeat transition validation in the database, independently authorize admin actions, and append exactly one history record.
- **TEST-022**: Guest lookup tests require both code and normalized phone and return indistinguishable generic responses for wrong code, wrong phone, missing order, and anonymized order.
- **TEST-023**: Guest lookup response tests assert absence of phone, address, internal UUIDs, provider payloads, credentials, and field-specific mismatch clues.
- **TEST-024**: Reporting tests reconcile daily/monthly order counts, gross paid totals, refunds, excluded unpaid states, actionable states, timezone boundaries, and empty periods.
- **TEST-025**: Retention tests anonymize only eligible completed/cancelled records older than one year, preserve reporting data, disable guest lookup, and remain idempotent.
- **TEST-026**: Rate-limit tests cover login, shipping, checkout/payment creation, and lookup allowed/throttled behavior with generic safe responses.
- **TEST-027**: Manual E2E covers login/logout, unauthorized access, product/image operations, cart recovery, RajaOngkir live success/failure, Duitku sandbox outcomes, fulfillment, tracking, guest lookup, privacy, retention, responsive widths, and keyboard navigation.
- **TEST-028**: Every task/batch gate runs `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`.
- **TEST-029**: Every database gate requires a green GitHub Actions run that performs empty migration replay and integration tests in a CI-hosted disposable stack, plus `npm run db:lint`, `npm run db:types`, generated-type diff review, and Supabase security/performance advisors; record the workflow run URL as evidence.
- **TEST-030**: Final release verification confirms no secret/PII leakage, no known incorrect total, duplicate stock decrement, negative stock, RLS bypass, unauthorized paid transition, or guest-order disclosure.

## 7. Risks & Assumptions

- **RISK-001**: Concurrent edits to migrations, generated types, package files, lockfiles, configuration, or global styles can create invalid ordering or lost changes; mitigation is the explicit serialization and file ownership in each phase.
- **RISK-002**: Database tests could damage shared data or exceed the operator laptop's resources; mitigation is mandatory CI-hosted disposable Supabase infrastructure in GitHub Actions, explicit rejection of shared-remote targets, and no local Docker requirement.
- **RISK-003**: RajaOngkir or Duitku contracts may differ from remembered or historical documentation; mitigation is the implementation-blocking current-documentation tasks and validated fixtures.
- **RISK-004**: Duitku may not reliably send expiration callbacks; mitigation is the explicit reconciliation fallback selected in Phase 4.
- **RISK-005**: A delayed paid callback may arrive after stock is consumed; mitigation is atomic `payment_review` behavior with preserved payment evidence and no partial decrement.
- **RISK-006**: Duplicate or concurrent callbacks may race; mitigation is unique event keys, row locks, deterministic product lock order, and real concurrency tests.
- **RISK-007**: Public lookup or provider routes may be abused; mitigation is bounded validation, generic responses, rate limiting, and sanitized logs.
- **RISK-008**: Image upload/database operations may leave orphaned or broken state; mitigation is UUID paths, ownership validation, cleanup attempts, and conservative deletion ordering.
- **RISK-009**: Supabase Free plan lacks automatic backups and may pause; mitigation is reproducible migrations/seeds, manual exports of important demo data, and documented recovery.
- **RISK-010**: Auth account loss is harder while password recovery is deferred; mitigation is operator-controlled provisioning and documented narrow Auth recovery procedures.
- **RISK-011**: Manual fulfillment, refund, and reconciliation steps may be missed; mitigation is actionable admin states, status history, structured events, and recovery checklists.
- **RISK-012**: Buyer PII may leak through logs, fixtures, errors, guest views, or callback payloads; mitigation is synthetic fixtures, approved safe view models, sanitized evidence, and final leakage review.
- **RISK-013**: UI work may drift into generic templates or inaccessible patterns; mitigation is semantic tokens, ReUI API reuse, documented responsive widths, and accessibility gates.
- **RISK-014**: The educational demo may be mistaken for commercial readiness; mitigation is the explicit single-store scope and separate future commercial review requirement.
- **ASSUMPTION-001**: The operator controls all Supabase, Vercel, Duitku, RajaOngkir, domain, and environment accounts used by the MVP.
- **ASSUMPTION-002**: One seller row and one linked Auth user are sufficient for the complete MVP.
- **ASSUMPTION-003**: Public seller signup remains disabled throughout implementation.
- **ASSUMPTION-004**: Current Phase 1 files and tests described in the source documents remain present and passing when execution begins.
- **ASSUMPTION-005**: GitHub-hosted runners provide sufficient Docker resources for the pinned Supabase CLI stack; the operator's machine is not expected to install or run Docker, and database-test feedback arrives only after a push-triggered CI run.
- **ASSUMPTION-006**: RajaOngkir supplies usable destination IDs and shipping rates for the configured origin and couriers.
- **ASSUMPTION-007**: Duitku sandbox supplies POP payment creation and authoritative callback behavior sufficient for acceptance.
- **ASSUMPTION-008**: One active payment attempt per order is sufficient unless provider testing proves a separate attempts table is necessary.
- **ASSUMPTION-009**: The operator accepts manual refunds, manual tracking entry, manual exceptional inventory resolution, and seller-confirmed completion.
- **ASSUMPTION-010**: `Asia/Jakarta` is the default reporting timezone unless the sole seller changes it.
- **ASSUMPTION-011**: No buyer accounts, variants, coupons, reviews, automated notifications, courier booking, automatic refunds, or automatic completion are required.
- **ASSUMPTION-012**: Password recovery and Auth callback implementation may remain deferred without blocking operator-controlled demo acceptance, provided the deferral and recovery procedure are documented.

## 8. Related Specifications / Further Reading

- `AGENTS.md`
- `tokonic-prd.md`
- `tokonic-technical-design-document.md`
- `docs/security-guidelines.md`
- `docs/ui-ux-guidelines.md`
- `docs/testing-guidelines.md`
- `docs/coding-standards.md`
- `package.json`
- `.env.example`
- `supabase/config.toml`
- `supabase/seed.sql`
