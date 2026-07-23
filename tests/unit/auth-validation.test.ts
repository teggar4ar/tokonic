import { describe, expect, it } from "vitest";
import { loginSchema } from "../../src/lib/validation/auth";

describe("loginSchema", () => {
  it("accepts a valid email and password", () => {
    expect(loginSchema.safeParse({ email: "admin@example.test", password: "secret" }).success).toBe(true);
  });

  it("rejects malformed credentials", () => {
    expect(loginSchema.safeParse({ email: "invalid", password: "" }).success).toBe(false);
  });

  it("rejects oversized passwords", () => {
    expect(loginSchema.safeParse({ email: "admin@example.test", password: "a".repeat(129) }).success).toBe(false);
  });
});
