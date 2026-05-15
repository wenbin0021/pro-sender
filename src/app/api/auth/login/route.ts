import { adminCredentials, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, signSession } from "@/lib/auth";

// POST /api/auth/login
// Body: { username, password }
// On success: sets the session cookie and returns { ok: true }.
//
// Runs on the Node.js runtime (not edge) so we have full access to env vars
// and can use bcrypt later without polyfills.
export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const username = String((body as { username?: unknown })?.username ?? "").trim();
  const password = String((body as { password?: unknown })?.password ?? "");

  const expected = adminCredentials();
  if (!expected.password) {
    return Response.json(
      { error: "auth not configured (ADMIN_PASSWORD is unset)" },
      { status: 503 },
    );
  }

  // Constant-time-ish comparison — fine for a single-user admin login where
  // we don't expect bursty timing attacks. Swap for bcrypt if you want to
  // store hashes instead of plaintext.
  const ok = username === expected.username && password === expected.password;
  if (!ok) {
    return Response.json({ error: "invalid credentials" }, { status: 401 });
  }

  const token = await signSession(username);
  const res = Response.json({ ok: true });
  res.headers.append(
    "Set-Cookie",
    [
      `${SESSION_COOKIE}=${token}`,
      "Path=/",
      `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
      "HttpOnly",
      "SameSite=Lax",
      // Cookie will be served over HTTP in dev — add Secure when behind HTTPS.
      process.env.NODE_ENV === "production" ? "Secure" : "",
    ]
      .filter(Boolean)
      .join("; "),
  );
  return res;
}
