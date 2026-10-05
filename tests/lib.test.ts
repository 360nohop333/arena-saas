import { describe, expect, it } from "vitest";

import { canDeleteProject, canManageMember, canManageWorkspace } from "@/lib/permissions";
import { hashPassword, verifyPassword } from "@/lib/password";
import { passwordStrength } from "@/lib/password-strength";
import { generateToken, hashToken, sessionExpiry } from "@/lib/tokens";
import { rateLimit, resetRateLimits } from "@/lib/rate-limit";
import { completionRate, colorFromString, initials, slugify, toDateInputValue } from "@/lib/utils";

describe("password hashing", () => {
  it("hashes with scrypt and verifies correctly", async () => {
    const hash = await hashPassword("Demo1234!");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(hash).not.toContain("Demo1234!");

    await expect(verifyPassword("Demo1234!", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong-password", hash)).resolves.toBe(false);
  });

  it("produces a different hash every time (unique salts)", async () => {
    const [a, b] = await Promise.all([hashPassword("Demo1234!"), hashPassword("Demo1234!")]);
    expect(a).not.toBe(b);
  });

  it("fails closed on malformed hashes", async () => {
    await expect(verifyPassword("Demo1234!", "garbage")).resolves.toBe(false);
    await expect(verifyPassword("Demo1234!", "")).resolves.toBe(false);
  });
});

describe("password strength meter", () => {
  it("scores weak passwords low and strong ones high", () => {
    expect(passwordStrength("abc").score).toBeLessThanOrEqual(1);
    expect(passwordStrength("Demo1234!").score).toBe(4);
    expect(passwordStrength("abc").problems.length).toBeGreaterThan(0);
  });
});

describe("tokens", () => {
  it("generates unique, high-entropy tokens and stable hashes", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(40);
    expect(hashToken(a)).toBe(hashToken(a));
    expect(hashToken(a)).not.toBe(hashToken(b));
  });

  it("never stores the raw token", () => {
    const token = generateToken();
    expect(hashToken(token)).not.toBe(token);
  });

  it("computes session expiry in the future", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    expect(sessionExpiry(now, 30).toISOString()).toBe("2026-01-31T00:00:00.000Z");
  });
});

describe("rate limiting", () => {
  it("allows up to the limit then blocks with a retry hint", () => {
    resetRateLimits();
    const key = "test:user";
    for (let i = 0; i < 3; i++) {
      expect(rateLimit(key, 3, 60_000).ok).toBe(true);
    }
    const blocked = rateLimit(key, 3, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("tracks buckets independently and resets after the window", async () => {
    resetRateLimits();
    expect(rateLimit("a", 1, 60_000).ok).toBe(true);
    expect(rateLimit("a", 1, 60_000).ok).toBe(false);
    expect(rateLimit("b", 1, 60_000).ok).toBe(true);

    resetRateLimits();
    expect(rateLimit("a", 1, 10).ok).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(rateLimit("a", 1, 10).ok).toBe(true);
  });
});

describe("permissions", () => {
  it("lets owners and admins manage the workspace", () => {
    expect(canManageWorkspace("OWNER")).toBe(true);
    expect(canManageWorkspace("ADMIN")).toBe(true);
    expect(canManageWorkspace("MEMBER")).toBe(false);
  });

  it("stops admins from managing owners or peers", () => {
    expect(canManageMember("OWNER", "ADMIN")).toBe(true);
    expect(canManageMember("OWNER", "MEMBER")).toBe(true);
    expect(canManageMember("ADMIN", "MEMBER")).toBe(true);
    expect(canManageMember("ADMIN", "ADMIN")).toBe(false);
    expect(canManageMember("ADMIN", "OWNER")).toBe(false);
    expect(canManageMember("MEMBER", "MEMBER")).toBe(false);
  });

  it("limits project deletion to admins and owners", () => {
    expect(canDeleteProject("OWNER")).toBe(true);
    expect(canDeleteProject("MEMBER")).toBe(false);
  });
});

describe("utils", () => {
  it("builds initials", () => {
    expect(initials("Alex Morgan")).toBe("AM");
    expect(initials("maya")).toBe("M");
    expect(initials("  ")).toBe("");
  });

  it("is deterministic for avatar colours", () => {
    expect(colorFromString("alex@example.com")).toBe(colorFromString("alex@example.com"));
    expect(colorFromString("a")).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("slugifies workspace names safely", () => {
    expect(slugify("Northwind Studio")).toBe("northwind-studio");
    expect(slugify("  Weird / Name!! ")).toBe("weird-name");
    expect(slugify("🔥")).toBe("workspace");
  });

  it("computes completion rate", () => {
    expect(completionRate([])).toBe(0);
    expect(completionRate([{ status: "DONE" }, { status: "TODO" }])).toBe(50);
    expect(completionRate([{ status: "DONE" }, { status: "DONE" }])).toBe(100);
  });

  it("formats dates for date inputs", () => {
    expect(toDateInputValue(null)).toBe("");
    expect(toDateInputValue(new Date("2026-11-30T12:00:00.000Z"))).toMatch(/^2026-11-(29|30|01)$/);
  });
});
