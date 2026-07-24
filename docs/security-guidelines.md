# Tokonic Security Guidelines

Use this checklist for every security-relevant code review. `AGENTS.md` and `tokonic-technical-design-document.md` remain authoritative.

## Known Issues Found During Audit

- [x] **PostgreSQL login rate limiting is implemented.** TASK-010A/B added the durable limiter migrations, disposable-stack integration tests, and fail-closed login integration; deployment order and generic failure behavior remain mandatory.
- [ ] **Remote Supabase leaked-password protection is disabled.** Enable it in Supabase Auth settings before production use.
- [ ] **Runtime RLS matrix tests are incomplete.** Add integration tests for `anon`, the linked admin, and a second unrelated authenticated user. Existing tests inspect the SQL contract but do not execute the full identity matrix.

Phase 1 otherwise follows the mandatory ownership, session-verification, and key-separation rules: `sellers` RLS uses `auth.uid()` ownership, protected data access calls `requireAdmin()`, logout independently verifies the Auth user, and no service-role/secret key client exists.

## Secrets and Environment Variables

- [ ] Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` may be read by browser-importable modules.
- [ ] Never prefix a secret, service-role key, provider credential, database password, or signing secret with `NEXT_PUBLIC_`.
- [ ] Read `SUPABASE_SECRET_KEY` only inside narrow modules containing `import "server-only"`; never import those modules from Client Components.
- [ ] Use a privileged Supabase client only for operations that genuinely require RLS bypass, such as verified payment callbacks, retention jobs, or operator recovery.
- [ ] Never use a privileged client to compensate for missing RLS on normal admin reads or writes.
- [ ] Read Duitku and RajaOngkir credentials only under `src/server/providers/` or another validated server-only boundary.
- [ ] Validate required environment variables at startup/build with separate public and server schemas; fail closed on missing or malformed values.
- [ ] Keep real values in ignored environment files or deployment secret storage; keep `.env.example` value-free.
- [ ] Never log passwords, session tokens, Supabase keys, provider credentials, callback authorization data, full phone numbers, or full addresses.
- [ ] If a secret enters source control or logs, revoke and rotate it immediately; deleting it is not sufficient.

## Supabase Clients and Sessions

- [ ] Browser code uses `src/lib/supabase/browser.ts` and the publishable key only.
- [ ] Server Components and Server Actions use the typed SSR client from `src/lib/supabase/server.ts`.
- [ ] Session refresh remains in `src/proxy.ts` and preserves every Supabase cookie option and response header.
- [ ] Authorization uses `auth.getUser()` or the current documented secure verification method; do not authorize from `getSession()` alone.
- [ ] Do not authorize from `user_metadata`; it is user-editable.
- [ ] Regenerate and commit `database.types.ts` after every migration; run `npm run db:types` and review the diff.

## Admin Authentication and Authorization

- [ ] Every protected Server Action, Route Handler, data module, and domain service independently verifies the session; layout protection is never sufficient.
- [ ] Admin data paths call `requireAdmin()` before querying protected data and use the returned `sellerId` for ownership scoping.
- [ ] An equivalent guard must securely verify the Auth user and the required authorization relationship; checking only that a cookie exists is insufficient.
- [ ] Every admin mutation repeats authorization at its own entry point, even when its UI is rendered inside the protected admin layout.
- [ ] Login validation and credential failures return the same generic message and do not reveal whether an email exists.
- [ ] Logout securely verifies the current Auth user, clears the SSR session through Supabase, handles failure generically, and redirects to `/admin/login`.
- [ ] Public signup remains disabled in the remote Supabase Auth configuration; provisioning is operator-controlled.
- [ ] Password recovery redirects are allowlisted to Tokonic domains and the reset page verifies the recovery session before accepting a new password.
- [ ] Invoke the durable PostgreSQL limiter before Supabase Auth password verification.
- [ ] Use separate keyed digests for canonical trusted client IP and normalized email; never store or log passwords, raw emails, raw IPs, full forwarding-header chains, or digest secrets.
- [ ] Derive client identity only from the officially verified Vercel trusted-proxy contract. Missing/untrusted identity, malformed configuration, or database/function failure denies login generically; never fall back to process memory.
- [ ] Validation, throttling, dependency failure, unknown accounts, and invalid credentials remain publicly indistinguishable.
- [ ] Apply rate limits to login and recovery endpoints before public deployment.

## Row Level Security

- [ ] Enable RLS in the same migration that creates every table exposed through the Data API.
- [ ] Revoke default access first, then grant only required operations and columns.
- [ ] `TO authenticated` is never authorization by itself; every seller-owned policy includes an ownership predicate.
- [ ] Direct seller rows use `(select auth.uid()) = auth_user_id`.
- [ ] Child rows use a predicate that maps their `seller_id`, product, or order relationship to `sellers.auth_user_id = auth.uid()`.
- [ ] UPDATE policies include both `USING` and `WITH CHECK`; required SELECT access is also present.
- [ ] Restrict immutable identifiers and audit fields with column grants, constraints, or triggers.
- [ ] Anonymous storefront reads expose only published/public-safe fields through narrow queries or `security_invoker` views.
- [ ] Guest order access never grants anonymous direct SELECT on order tables.
- [ ] Revoke function execution from `PUBLIC` by default; prefer `SECURITY INVOKER`.
- [ ] Any necessary `SECURITY DEFINER` function uses a safe/empty `search_path`, fully qualified objects, explicit internal authorization, and narrowly granted execution.
- [ ] Test each policy as `anon`, the owning admin, and a second unrelated authenticated user; the unrelated user must read and mutate zero rows.
- [ ] The limiter table has RLS enabled with no browser, `anon`, or authenticated direct access; revoke its table/function privileges from `PUBLIC`, `anon`, and `authenticated` and grant only the narrow trusted server caller.
- [ ] If the atomic limiter function uses `SECURITY DEFINER`, place it in a non-exposed schema with a safe `search_path`, fully qualified objects, and narrow execution grants.
- [ ] Test limiter grants, concurrency, reset, successful-login email-bucket deletion, and cleanup in the CI disposable stack.
- [ ] Run Supabase security and performance advisors after every database migration.

## Server-Side Input and Commerce Integrity

- [ ] Treat form fields, route params, query params, JSON bodies, cookies, provider responses, and uploaded metadata as untrusted.
- [ ] Parse every Server Action and Route Handler input with a domain Zod schema under `src/lib/validation/` before domain logic.
- [ ] Trim and normalize inputs server-side; enforce length, enum, UUID, integer, and collection-size bounds.
- [ ] Use typed Supabase query methods or parameterized PostgreSQL functions; never interpolate input into SQL.
- [ ] Render user-controlled text through React escaping; do not use `dangerouslySetInnerHTML` without an approved sanitizer and review.
- [ ] Never trust client-submitted prices, totals, shipping costs, weights, stock, order state, seller identity, or ownership.
- [ ] At checkout, fetch current products and recalculate price, subtotal, weight, shipping, and total server-side using integer rupiah arithmetic.
- [ ] Return stable, generic public errors; do not expose stack traces, raw provider payloads, internal UUIDs, or authorization details.

## Guest Order Lookup

- [ ] Require both a validated random order code and normalized phone number for every lookup.
- [ ] Query with both values in one narrow server-only privileged operation; do not reveal which value mismatched.
- [ ] Return the same generic not-found response for missing orders, wrong codes, wrong phones, and anonymized records.
- [ ] Return only the approved public order view model; exclude full address, phone, internal IDs, provider payloads, and secrets.
- [ ] Never place the buyer phone in a URL.
- [ ] Rate-limit lookup attempts and avoid logging raw lookup credentials.

## Later Phases — Enforce Before Implementation

### Shipping and Checkout — Applies Starting Phase 3

- [ ] Keep RajaOngkir credentials server-only and allowlist the provider host; never fetch a client-supplied URL.
- [ ] Add bounded timeouts, validate provider responses with Zod, and return sanitized errors.
- [ ] Recalculate the selected shipping rate during final order creation.

### Payment Webhooks — Applies Starting Phase 4

- [ ] Read the callback body once, validate required fields, and verify the official Duitku signature before any state change.
- [ ] Verify merchant identity, order relationship, reference, and integer amount against persisted server data.
- [ ] Only a verified callback may mark an order paid; browser redirects never change payment state.
- [ ] Derive a deterministic event key and enforce uniqueness so callback replay cannot duplicate state or stock changes.
- [ ] Process payment evidence, order transition, history, and stock decrement in one database transaction.
- [ ] Lock product rows deterministically and decrement with `stock >= quantity`; never reserve stock at checkout.
- [ ] Preserve paid evidence and move to `payment_review` when paid inventory cannot be fulfilled.
- [ ] Store only sanitized callback evidence; never store secrets, authorization headers, or unnecessary PII.

### Supabase Storage Uploads — Applies Before First Upload Feature (Phase 2)

- [ ] Accept only JPEG, PNG, and WebP; reject SVG and validate actual processed MIME/type rather than extension alone.
- [ ] Enforce at most five images per product and a maximum stored size of 2 MB per image on client, server, and Storage configuration where applicable.
- [ ] Require an existing owned product before upload and use `products/{product_id}/{uuid}.{ext}` paths.
- [ ] Storage policies verify product ownership for insert, select, update, and delete; authenticated role membership alone is insufficient.
- [ ] Avoid upsert and untrusted original filenames; generate a new UUID path for replacements.
- [ ] Validate uploaded object metadata/path before inserting `product_images` and clean up orphaned objects after failed database writes.
- [ ] Delete objects through the Storage API, not direct writes to `storage.objects`.

## Review Gate

- [ ] Threat boundaries and abuse cases are identified for the change.
- [ ] Authentication, authorization, validation, RLS, and least-privilege grants are independently reviewed.
- [ ] `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` pass.
- [ ] Database changes pass `npm run db:lint`, migration dry-run, generated-type review, and Supabase advisors.
- [ ] Record the green disposable-database workflow URL before applying the reviewed limiter migration remotely.
- [ ] Apply the limiter migration before dependent application code and verify login fails closed if the function is unavailable.
- [ ] `npm audit` findings are triaged by reachability and fix availability; never run forced remediation automatically.
- [ ] No secret or unnecessary PII appears in source, fixtures, responses, or logs.
