import { createHmac, randomBytes, randomUUID } from "node:crypto";

import { serverEnv } from "@/lib/env";

/**
 * Opaque token helpers.
 *
 * Tokens are high-entropy random strings handed to the client; only an
 * HMAC-SHA256 digest is persisted, so a database leak cannot be replayed.
 */

export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHmac("sha256", serverEnv().SESSION_SECRET).update(token).digest("hex");
}

export function generateId(): string {
  return randomUUID();
}

export function sessionExpiry(from: Date = new Date(), days = 30): Date {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

export function resetTokenExpiry(from: Date = new Date(), hours = 1): Date {
  return new Date(from.getTime() + hours * 60 * 60 * 1000);
}

export function inviteExpiry(from: Date = new Date(), days = 14): Date {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}
