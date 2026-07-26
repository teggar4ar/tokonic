# Tokonic Testing Guidelines

Living checklist for deciding, writing, and reviewing tests. `AGENTS.md` and `tokonic-technical-design-document.md` remain authoritative.

## Baseline Established So Far

Phase 1 currently has two Vitest files under `tests/unit/`:

- `auth-validation.test.ts` exercises `loginSchema` as a pure unit.
- `seller-migration.test.ts` reads migration SQL and asserts security-contract text.

Established conventions:

- Test files use lowercase kebab-case with `.test.ts` and mirror the tested domain: `<behavior-or-domain>.test.ts`.
- Import `describe`, `it`, and `expect` directly from `vitest`.
- Use one top-level `describe` per unit or contract and behavior-oriented `it("...")` descriptions.
- Keep arrange/act/assert compact; inline trivial inputs and extract fixtures only when reused or complex.
- Prefer explicit assertions such as `toBe`, `toContain`, and `toMatch` over broad snapshots.
- Pure unit tests have no setup/teardown when no shared state exists.
- No Supabase client is mocked in the current baseline.
- The GitHub Actions workflow now starts a CI-hosted disposable Supabase stack, replays migrations, runs integration suites, and tears down; the operator's machine is not expected to run Docker.
- `seller-migration.test.ts` is a static SQL contract test, **not** proof that migrations execute or RLS works at runtime.
- There is no project `vitest.config.*` yet; `npm test` runs Vitest defaults.

Current gaps relative to the TDD:

- [x] GitHub Actions PostgreSQL/Supabase integration workflow exists and runs on every branch push; TASK-007B evidence is recorded in `implementation-plan.md`.
- [x] Runtime seller RLS matrix covers anon, linked admin, and unrelated authenticated user. Evidence: https://github.com/teggar4ar/tokonic/actions/runs/30088652557.
- [ ] No route/service integration tests exist.
- [ ] No automated auth session/cookie test exists; login/logout remains manual E2E.
- [ ] No concurrency, payment, inventory, guest lookup, provider, or Storage tests exist because those features are not implemented yet.

## Where Tests Are Required

Tokonic uses **Vitest for critical logic and integration boundaries; manual E2E for the rest**.

Add automated coverage when a change can affect any of these:

- Money, totals, shipping cost, weight, stock, or inventory concurrency.
- Payment signatures, callback validation, idempotency, or order/payment state.
- Authorization, RLS, ownership isolation, privileged access, or PII disclosure.
- Order transition rules, snapshots, retention, or destructive behavior.
- Input normalization/validation reused by server boundaries.
- Provider request/response mapping, timeout/error normalization, or signatures.
- Database constraints, functions, triggers, grants, policies, or migrations.
- A previously fixed regression in a critical path.

Manual testing is sufficient for low-risk presentation and framework composition when no business/security invariant is introduced, including:

- Static copy and basic layout.
- Visual spacing, responsive polish, and non-authoritative formatting.
- Standard shadcn/ReUI composition already covered by its library.
- Basic navigation wiring that does not carry authentication proof or sensitive data.

Manual-only is **not** sufficient merely because a behavior is hard to test. Payment, stock, RLS, privacy, and state-machine behavior require automated evidence.

## Test Levels

### Unit — `tests/unit/`

Use for deterministic logic without network/database state:

- Zod schemas and normalization helpers.
- Integer money, total, and weight calculations.
- Order-code properties and order transition validator.
- Provider mappers, signatures, callback status mapping, and official fixtures.
- Image validation and retention eligibility.

Prefer real inputs and outputs. Do not mock a pure function's internals.

### Database Integration — `tests/integration/database/`

Use a CI-hosted disposable Supabase PostgreSQL database in GitHub Actions for:

- Constraints, triggers, grants, and RLS behavior.
- Transactional PostgreSQL functions.
- Callback replay and concurrent stock changes.
- Snapshot persistence and retention.

Rules:

- Database integration suites run only in the GitHub Actions hosted runner; they are not expected to run on the operator's machine.
- Never install or require local Docker for these suites, and never run destructive integration tests against the shared remote development project.
- The future workflow must trigger on every push to every branch, start the Supabase CLI stack in the runner, replay migrations from empty, seed deterministic synthetic fixtures and Auth identities, run the suites, and tear down even on failure.
- Start from reviewed migrations and deterministic synthetic fixtures.
- Use distinct synthetic identities for owner and unrelated authenticated user.
- Reset/clean state between tests or suites; do not depend on execution order.
- Assert database state after the operation, not only returned status.
- Static SQL text assertions may supplement but never replace runtime database tests.

PostgreSQL-backed rate limiting is a database integration concern. Write the failing database test first, then the migration, push the smallest coherent commit, and use the resulting CI run as the red/green feedback loop. A local fake may test service response mapping but is not evidence of durable or concurrent limiting.
- A database gate is complete only when the pushed commit has a green workflow run and its URL is recorded as evidence.

### CI-Only Setup and Feedback Loop

To write a database test for CI:

1. Add the behavior-focused test under `tests/integration/database/` and deterministic reusable builders under `tests/fixtures/`.
2. Read connection details only from the CI test environment supplied by the disposable runner stack; never add shared-remote credentials or hardcoded endpoints.
3. Make setup idempotent, isolate records with synthetic identities/UUIDs, and clean or reset state without depending on test order.
4. Push the smallest useful change to any branch; database integration tests are not expected to run locally.
5. Open the GitHub Actions run for that pushed commit, inspect the migration, seed, and integration-test steps, and record the green run URL in the task/release evidence.

This strategy has a delayed feedback loop: results arrive only after pushing and waiting for GitHub Actions. Keep database changes small and push more frequently so migration, RLS, Storage, and concurrency failures are discovered early.

### Route/Service Integration — `tests/integration/services/`

Use for boundaries involving services, provider adapters, authorization, or safe responses:

- Mock or record external provider HTTP responses at the provider boundary.
- Never call live Duitku from normal automated tests.
- RajaOngkir live verification belongs to a controlled smoke/manual test; deterministic tests use recorded validated fixtures.
- Assert both accepted and adversarial inputs: tampered totals, invalid signatures, missing sessions, unrelated users, malformed provider responses.
- Verify public error shape and absence of internal/PII fields.
- Mock the narrow limiter data adapter only to verify login-boundary ordering, generic responses, trusted-client identity handling, and fail-closed behavior. Never use a process-local `Map` as the production provider or as proof of database atomicity.

### Manual End-to-End

Run against the intended preview/demo environment for:

- Auth login, logout, recovery, and direct unauthorized navigation.
- Product CRUD and image upload/delete UX.
- Cart persistence and malformed local state.
- Duitku POP sandbox behavior and enabled payment methods.
- RajaOngkir live destination/rate success and failure UX.
- Complete checkout, fulfillment, tracking, responsive, keyboard, and privacy flows.

Record the environment, fixture/order code, scenario, expected result, actual result, and date. Manual E2E complements—not replaces—critical automated tests.

## Critical-Path Completion Checklist

Do not mark the relevant phase done until its required items are automated.

### Foundation / Access Control

- [x] Login Zod validation basics — unit contract exists.
- [x] Seller migration contains expected RLS ownership predicates — static SQL contract only.
- [x] The GitHub Actions disposable stack executes migrations cleanly from an empty database on every branch push; TASK-007B evidence is recorded in `implementation-plan.md`.
- [x] PostgreSQL login limiter tests prove two-bucket allowed attempts, atomic throttling under concurrency, reset, key isolation, restricted grants, successful-login email-bucket deletion, and idempotent cleanup. Evidence: https://github.com/teggar4ar/tokonic/actions/runs/30076650889.
- [x] Login service tests prove trusted-client identity handling, generic failures, operation ordering, and fail-closed database/configuration behavior. Evidence: https://github.com/teggar4ar/tokonic/actions/runs/30081482977.
- [x] Runtime RLS matrix proves anon cannot read, owner can read/update only its row, and a second unrelated authenticated user reads/mutates zero rows. Evidence: https://github.com/teggar4ar/tokonic/actions/runs/30088652557.
- [x] The `requireAdmin()` seller lookup pattern permits the linked owner and rejects anon/unrelated identities through runtime RLS. Evidence: https://github.com/teggar4ar/tokonic/actions/runs/30088652557.

### Checkout / Shipping — Required When Implemented

- [ ] **Not yet implemented:** integer subtotal, shipping, grand total, and weight calculations.
- [ ] **Not yet implemented:** checkout rejects client-tampered product prices and shipping costs.
- [ ] **Not yet implemented:** duplicate submission key returns the existing matching order or a conflict, never a second payable order.
- [ ] **Not yet implemented:** RajaOngkir destination/rate mapping covers valid, malformed, timeout, and provider-error fixtures.

### Payment / Inventory — Required Before Phase 4 Is Done

- [ ] **Not yet implemented:** Duitku signature/request/callback mapping uses official fixtures.
- [ ] **Not yet implemented:** invalid signature, amount, merchant ID, reference, and unknown order are rejected without business effects.
- [ ] **Not yet implemented:** payment callback replay is idempotent and stock is decremented exactly once.
- [ ] **Not yet implemented:** concurrent successful callbacks produce one accepted paid transition.
- [ ] **Not yet implemented:** multi-product stock decrement is atomic; no partial decrement survives failure.
- [ ] **Not yet implemented:** stock never becomes negative under competing requests.
- [ ] **Not yet implemented:** insufficient stock preserves paid evidence, performs no partial decrement, and enters `payment_review`.
- [ ] **Not yet implemented:** expiration cancels pending order without changing stock.
- [ ] **Not yet implemented:** payment creation uses the persisted server-calculated total.

### Orders / Privacy — Required When Implemented

- [ ] **Not yet implemented:** pure order transition validator accepts only allowed transitions and requires tracking for shipment.
- [ ] **Not yet implemented:** authoritative database mutation rejects skipped/backward transitions and records history.
- [ ] **Not yet implemented:** order item snapshots survive product update, unpublish, or allowed deletion behavior.
- [ ] **Not yet implemented:** guest lookup requires both order code and normalized phone.
- [ ] **Not yet implemented:** wrong code, wrong phone, missing order, and anonymized order return the same generic not-found response and leak no field-specific clue.
- [ ] **Not yet implemented:** retention anonymizes only eligible completed/cancelled orders and is idempotent.

## Naming and Structure

Name tests after the behavior/domain, not the implementation file when that would be unclear:

```text
tests/unit/auth-validation.test.ts
tests/unit/order-transition.test.ts
tests/unit/duitku-signature.test.ts
tests/integration/database/seller-rls.test.ts
tests/integration/database/payment-inventory.test.ts
tests/integration/services/guest-order-lookup.test.ts
```

Canonical unit shape:

```ts
import { describe, expect, it } from "vitest";
import { normalizePhone } from "../../src/lib/phone";

describe("normalizePhone", () => {
  it("normalizes an Indonesian local number", () => {
    const result = normalizePhone("0857 1234 5678");

    expect(result).toBe("6285712345678");
  });

  it("rejects an invalid number", () => {
    expect(() => normalizePhone("abc")).toThrow();
  });
});
```

For integration suites:

- Put shared synthetic records/builders under `tests/fixtures/`.
- Let the GitHub Actions workflow own Supabase stack startup, empty migration replay, synthetic seed setup, and unconditional teardown; tests own only suite/record isolation.
- Use `beforeAll` only for expensive suite fixtures, `beforeEach` for isolation, and `afterAll` for cleanup.
- Keep each test readable as arrange → act → assert; separate phases with whitespace rather than comments.
- Name tests by observable behavior: `it("does not decrement stock when the callback is replayed")`.
- Test the public/service/database boundary, not private helper call order.
- Include at least one abuse/failure case for every success case on security or payment boundaries.

## Mocking and Fixtures

- Do not mock the function under test or Supabase query chains merely to assert calls.
- Pure domain tests use no Supabase mock.
- Database behavior uses the real CI-hosted disposable PostgreSQL/Supabase stack; do not claim RLS coverage from mocked clients, local Docker, or the shared remote project.
- Provider adapters use official or sanitized recorded fixtures. Remove secrets, authorization headers, and PII.
- Fix time, UUIDs, and provider responses when determinism matters.
- Concurrency tests issue genuinely overlapping database operations and assert final persisted state.
- Never place real buyer data, provider secrets, or operator credentials in fixtures.
- Limiter fixtures use synthetic identities and fixed timestamps; never include operator email, raw IP, password, digest secret, forwarding-header chain, or shared-remote credentials in fixtures or failure output.

## What Not to Test

- Do not add broad UI snapshot tests; they are brittle and do not prove commerce correctness.
- Do not test React, Next.js, Zod, Supabase, shadcn/ReUI, or Heroicons internals.
- Do not assert Tailwind class strings unless a class is itself a required accessibility/state behavior.
- Do not test private implementation details, internal helper call counts, or exact raw provider error wording.
- Do not duplicate TypeScript compiler, ESLint, or database-linter checks in Vitest.
- Do not use static migration text tests as the only evidence for constraints, grants, RLS, triggers, or functions.
- Do not call shared remote development data from destructive or concurrency tests.
- Do not chase coverage percentage with low-value tests; prioritize financial, authorization, privacy, and state integrity.

## Feature Review Checklist

- [ ] Identify financial, authorization, privacy, concurrency, and provider failure modes before implementation.
- [ ] Add unit tests for deterministic critical logic.
- [ ] Add real database integration tests for SQL constraints, RLS, triggers, and transactional functions.
- [ ] Add route/service integration tests for authorization, tampering, provider validation, and safe errors.
- [ ] Add abuse/replay/concurrency cases where applicable.
- [ ] Use only synthetic, sanitized, deterministic fixtures.
- [ ] Update the critical-path checklist in this document from “not yet implemented” only when the named automated test exists and passes.
- [ ] Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` locally where applicable.
- [ ] For database changes, push the commit and confirm the GitHub Actions workflow performs empty migration replay and integration tests in its disposable Supabase stack; also complete `npm run db:lint`, generated-type checks, and Supabase advisors.
- [ ] Record the green database workflow run URL as task/phase evidence; do not substitute a shared-remote or operator-local Docker run.
- [ ] Complete the relevant manual E2E scenarios before phase acceptance.
