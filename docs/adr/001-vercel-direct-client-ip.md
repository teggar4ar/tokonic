# ADR 001: Vercel Direct Client IP Contract

- Status: Accepted
- Decision date: 2026-07-24
- Documentation retrieved: 2026-07-24

## Context

Tokonic derives one login rate-limit bucket from the request's canonical client IP. The application must accept that identity only when the hosting platform supplies a spoof-resistant value.

## Official source

Vercel, "Request headers," `x-forwarded-for` and `x-vercel-forwarded-for`: https://vercel.com/docs/headers/request-headers

Retrieved on 2026-07-24. Vercel documents that, for ordinary direct deployments, it replaces the incoming `x-forwarded-for` value with the public client IP rather than forwarding a caller-provided value, preventing direct spoofing. It separately documents proxy-specific behavior, including an Enterprise trusted-proxy option and `x-vercel-forwarded-for` when another proxy sits in front of Vercel.

## Decision

`vercel-direct` is valid only when `VERCEL=1` and Tokonic is reached directly through Vercel without a trusted proxy or another proxy in front. Tokonic reads exactly one `x-forwarded-for` address, canonicalizes valid IPv4 or IPv6, and fails closed for missing, repeated, list-valued, comma-chained, whitespace-ambiguous, or malformed values. A future proxy topology requires a new reviewed mode rather than reusing `vercel-direct`.

## Consequences

The direct Vercel contract does not trust arbitrary caller forwarding headers and does not provide a permissive fallback. Any Vercel documentation or deployment-topology change requires this ADR, the TDD, configuration validation, and login identity tests to be reviewed together.
