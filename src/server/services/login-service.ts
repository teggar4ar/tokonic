import "server-only";

import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { loginSchema } from "../../lib/validation/auth";

const genericFailure = { ok: false, error: "invalid" } as const;
const success = { ok: true } as const;

export type LoginRateLimitConfig = {
  deployment: "vercel" | "localhost-development";
  proxyMode: "vercel-direct" | "localhost-development";
  attempts: 5;
  windowSeconds: 900;
  digestSecret: string;
};

type LoginHeaders = Headers | Record<string, unknown>;

export type LoginDependencies = {
  consume(input: { ipDigest: string; emailDigest: string }): Promise<{ allowed: boolean; resetAt: string }>;
  authenticate(input: { email: string; password: string }): Promise<{ ok: boolean }>;
  deleteEmailBucket(emailDigest: string): Promise<void>;
  rollbackSession(): Promise<void>;
};

export type LoginBoundaryDependencies<Environment> = {
  readEnvironment(): Environment;
  getConfig(environment: Environment): LoginRateLimitConfig;
  getHeaders(): Promise<LoginHeaders>;
  createDependencies(environment: Environment): Promise<LoginDependencies>;
};

export function parseLoginRateLimitConfig(env: Record<string, string | undefined>): LoginRateLimitConfig {
  const proxyMode = env.LOGIN_RATE_LIMIT_TRUSTED_PROXY_MODE;
  const validVercel = proxyMode === "vercel-direct" && env.VERCEL === "1";
  const validLocalhost = proxyMode === "localhost-development" && env.NODE_ENV !== "production" && env.VERCEL === undefined;

  if (
    (!validVercel && !validLocalhost) ||
    env.LOGIN_RATE_LIMIT_ATTEMPTS !== "5" ||
    env.LOGIN_RATE_LIMIT_WINDOW_SECONDS !== "900" ||
    !env.LOGIN_RATE_LIMIT_DIGEST_SECRET ||
    env.LOGIN_RATE_LIMIT_DIGEST_SECRET.length < 32
  ) {
    throw new Error("Invalid login configuration");
  }

  return {
    deployment: validVercel ? "vercel" : "localhost-development",
    proxyMode,
    attempts: 5,
    windowSeconds: 900,
    digestSecret: env.LOGIN_RATE_LIMIT_DIGEST_SECRET,
  };
}

function mappedIpv4(value: string) {
  const match = value.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  return match?.[1] ?? null;
}

export function canonicalizeTrustedClientIp(value: string) {
  if (!value || value.trim() !== value || value.includes(",") || value.includes("%")) {
    throw new Error("Invalid client identity");
  }

  const mapped = mappedIpv4(value);
  if (mapped) {
    return canonicalizeTrustedClientIp(mapped);
  }

  const version = isIP(value);

  if (version === 4) {
    const octets = value.split(".");
    if (octets.length !== 4 || octets.some((octet) => !/^(0|[1-9][0-9]{0,2})$/.test(octet))) {
      throw new Error("Invalid client identity");
    }
    return octets.map(Number).join(".");
  }

  if (version === 6) {
    const canonical = new URL(`http://[${value}]/`).hostname.slice(1, -1).toLowerCase();
    const hexadecimalMapped = canonical.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);

    if (hexadecimalMapped) {
      const high = Number.parseInt(hexadecimalMapped[1], 16);
      const low = Number.parseInt(hexadecimalMapped[2], 16);
      return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
    }

    return canonical;
  }

  throw new Error("Invalid client identity");
}

export function deriveLoginDigests(input: { email: string; canonicalIp: string; secret: string }) {
  const normalizedEmail = input.email.trim().toLowerCase();

  return {
    normalizedEmail,
    emailDigest: createHmac("sha256", input.secret).update(`email:${normalizedEmail}`).digest("hex"),
    ipDigest: createHmac("sha256", input.secret).update(`ip:${input.canonicalIp}`).digest("hex"),
  };
}

function readForwardedFor(headers: LoginHeaders) {
  if (headers instanceof Headers) {
    return headers.get("x-forwarded-for");
  }

  const value = headers["x-forwarded-for"];
  return typeof value === "string" ? value : null;
}

export async function loginWithRateLimit(
  input: { email: unknown; password: unknown; headers: LoginHeaders; config: LoginRateLimitConfig },
  dependencies: LoginDependencies,
) {
  try {
    const parsed = loginSchema.safeParse({ email: input.email, password: input.password });

    if (!parsed.success) {
      return genericFailure;
    }

    const canonicalIp =
      input.config.proxyMode === "localhost-development"
        ? "127.0.0.1"
        : canonicalizeTrustedClientIp(readForwardedFor(input.headers) ?? "");
    const digests = deriveLoginDigests({
      email: parsed.data.email,
      canonicalIp,
      secret: input.config.digestSecret,
    });
    const limiter = await dependencies.consume({
      ipDigest: digests.ipDigest,
      emailDigest: digests.emailDigest,
    });

    if (!limiter.allowed) {
      return genericFailure;
    }

    const authentication = await dependencies.authenticate({
      email: digests.normalizedEmail,
      password: parsed.data.password,
    });

    if (!authentication.ok) {
      return genericFailure;
    }

    try {
      await dependencies.deleteEmailBucket(digests.emailDigest);
    } catch {
      await dependencies.rollbackSession();
      return genericFailure;
    }

    return success;
  } catch {
    return genericFailure;
  }
}

export async function executeLoginBoundary<Environment>(
  credentials: { email: unknown; password: unknown },
  dependencies: LoginBoundaryDependencies<Environment>,
) {
  try {
    const environment = dependencies.readEnvironment();
    const config = dependencies.getConfig(environment);
    const requestHeaders = await dependencies.getHeaders();
    const loginDependencies = await dependencies.createDependencies(environment);
    return await loginWithRateLimit({ ...credentials, headers: requestHeaders, config }, loginDependencies);
  } catch {
    return genericFailure;
  }
}
