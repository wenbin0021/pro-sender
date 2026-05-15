import { SignJWT, jwtVerify } from "jose";

// Single-user admin auth. Login flow:
//   1. POST /api/auth/login with { username, password }
//   2. Server compares against ADMIN_USERNAME / ADMIN_PASSWORD env vars
//   3. On success, server sets an HTTP-only session cookie containing a
//      signed JWT.
//   4. The Next.js middleware verifies that cookie on every request and
//      redirects to /login if it's missing or invalid.

export const SESSION_COOKIE = "ps_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

function authSecret(): Uint8Array {
  const raw = process.env.AUTH_SECRET;
  if (!raw || raw.length < 16) {
    // We don't want to silently weaken auth — failing closed forces the
    // operator to set AUTH_SECRET in .env.local before logins start working.
    throw new Error(
      "AUTH_SECRET environment variable is required (at least 16 chars)",
    );
  }
  return new TextEncoder().encode(raw);
}

export interface SessionPayload {
  sub: string; // username
  iat: number;
  exp: number;
}

export async function signSession(username: string): Promise<string> {
  return await new SignJWT({ sub: username })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(authSecret());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify<SessionPayload>(token, authSecret());
    if (!payload.sub) return null;
    return payload;
  } catch {
    return null;
  }
}

export function adminCredentials() {
  return {
    username: (process.env.ADMIN_USERNAME ?? "admin").trim(),
    password: process.env.ADMIN_PASSWORD ?? "",
  };
}
