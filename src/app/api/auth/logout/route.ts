import { SESSION_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";

// POST /api/auth/logout — clears the session cookie.
export async function POST() {
  const res = Response.json({ ok: true });
  res.headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`,
  );
  return res;
}
