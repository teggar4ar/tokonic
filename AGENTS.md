# Tokonic — Agent Instructions

## Project Overview

Tokonic is a single-tenant online store web application built to solve a real pain point: UMKM (small/micro business) sellers lose significant revenue to marketplace commission fees. Tokonic gives a seller their own branded storefront with checkout, payment, shipping-cost calculation, and order/fulfillment management, at a flat setup fee + monthly subscription instead of a percentage cut.

## External File Loading

CRITICAL: When you encounter a file reference written as `@filename`, use your Read tool to load it on a need-to-know basis. Only load it when it's relevant to the SPECIFIC task at hand.

Instructions:

- Do NOT preemptively load all references at the start of a session — use lazy loading based on actual need.
- When loaded, treat the file's content as mandatory instructions that override any conflicting default behavior.
- Follow references recursively if a loaded file itself references other files.

## Current Phase — Read This First

This implementation currently builds **one store for the operator's own personal use and validation**. All third-party accounts in use (Vercel, Supabase, Duitku, RajaOngkir) belong to the operator, not to an external seller. The multi-seller SaaS model described in the PRD (per-seller deployment, setup fee, subscription, per-seller unit economics) is the intended direction **after** this personal validation phase proves promising — it is not being built yet.

Do not implement multi-tenant data sharing, per-seller Supabase project provisioning, or automated seller onboarding/billing unless explicitly asked. Treat any PRD language about "sellers" (plural) as describing the future commercial direction, not the current build target.

## Source of Truth

- @tokonic-prd.md — product requirements, scope, priorities, open decisions.
- @tokonic-technical-design-document.md — full technical design: architecture, database schema, RLS policies, payment/inventory algorithm, route design, testing strategy. **This is the primary technical reference.**
- @implementation-plan.md — current implementation status, task dependencies, parallel batches, and concrete completion criteria.

Read @implementation-plan.md at the start of every session that will touch implementation work. Use it to determine the current task status, dependencies, and next actionable task; this requirement overrides the ordinary lazy-loading rule.

Read @tokonic-technical-design-document.md fully before starting any non-trivial feature. It contains the authoritative schema, state machine, and integration design — do not re-derive these from scratch or from general framework knowledge.

## Tech Stack

| Concern | Choice |
|---|---|
| Language | TypeScript (strict mode) |
| Framework | Next.js App Router |
| Backend platform | Supabase (PostgreSQL, Auth, Storage) — one project |
| UI | ReUI / shadcn-compatible components, Tailwind CSS, Heroicons |
| Forms/validation | React Hook Form + Zod |
| Cart | React Context, persisted to `localStorage` (no DB cart table) |
| Payment | Duitku POP, direct REST integration (no unmaintained SDK) |
| Shipping | RajaOngkir API V2 |
| Testing | Vitest for critical logic; manual end-to-end for the rest |
| Hosting | Vercel |

## Non-Negotiable Rules

These rules exist because violating them causes financial or security defects, not just style issues:

1. **Money is always integer/`bigint` rupiah.** Never floating point.
2. **Every admin mutation independently verifies the Supabase Auth session** (via `requireAdmin()` or equivalent) — never rely on layout-level protection alone.
3. **RLS must be enabled on every table** exposed through the Supabase Data API, with explicit ownership predicates (`seller_id` → `auth.uid()`). The `authenticated` role alone is never sufficient authorization.
4. **The Supabase secret/service-role key never reaches browser code.** Only the publishable key is public.
5. **Order totals, prices, and shipping costs are always recalculated server-side** at checkout. Client-submitted values are never trusted.
6. **Stock is never reserved.** It is only decremented via an atomic conditional update (`stock = stock - qty WHERE stock >= qty`) inside the payment webhook, after verified payment.
7. **Payment webhook processing must be idempotent and transactional.** Replaying a callback must never double-decrement stock or duplicate state.
8. **Only a verified Duitku callback can mark an order `paid`.** Browser redirects are user feedback only, never a trust signal.
9. **Guest order lookup requires both order code and normalized phone**, and returns a generic not-found response on any mismatch (do not reveal which field was wrong).

If a task seems to require breaking one of these rules, stop and ask rather than proceeding.

## Project Structure

Follow the directory layout defined in @tokonic-technical-design-document.md Section 4.1. Key boundaries:

- `src/server/services/` — domain logic (checkout, payment, order, product). Business rules live here, not in Route Handlers or Server Actions.
- `src/server/providers/` — third-party adapters (Duitku, RajaOngkir). All provider-specific request/response shapes are normalized at this boundary.
- `src/server/data/` — typed Supabase queries. Every module touching privileged data uses `import 'server-only'`.
- `src/app/admin/*` — authenticated seller admin routes.
- `src/app/(storefront)/*` — public buyer-facing routes.
- Route Handlers are used specifically for third-party callbacks (Duitku) and provider proxying (RajaOngkir); prefer Server Actions for authenticated admin mutations.

## Commands

```
dev:       npm run dev
build:     npm run build
lint:      npm run lint
test:      npm test
typecheck: npm run typecheck
```

## Conventions

- Use `snake_case` for database identifiers, `camelCase` for TypeScript.
- Every Zod schema used for server-side validation lives under `src/lib/validation/`, one file per domain area.
- Generate and commit Supabase TypeScript types after every schema migration; do not let them go stale.
- Prefer Server Components by default; use Client Components only when a browser API or interactivity requires it.
- Do not add an ORM (Prisma, Drizzle, etc.) — this project deliberately uses the Supabase typed client and PostgreSQL functions directly, per the TDD.

## Documentation References

Detailed guidance lives in separate files, following the External File Loading rule above — load them only when the current task needs that specific domain:

- Full architecture, schema, RLS policies, and the payment/inventory algorithm: @tokonic-technical-design-document.md
- Product scope, priorities, and open decisions: @tokonic-prd.md
- Security checklist: @docs/security-guidelines.md
- UI/UX component and layout conventions: @docs/ui-ux-guidelines.md
- Testing patterns and fixtures: @docs/testing-guidelines.md
- Code style conventions: @docs/coding-standards.md

Do not attempt to read a file marked "not yet created" — check whether it exists first. Once any of these files is created, its contents become mandatory for tasks in its domain.