import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";

// Routes that are always reachable without a session:
//   /login                — the login page itself
//   /api/auth/*           — login + logout endpoints
//   /api/webhook/*        — provider callbacks (auth via shared secret instead)
//   /_next/*, /favicon.*  — Next.js static assets
const PUBLIC_PREFIXES = [
  "/login",
  "/api/auth/",
  "/api/webhook/",
  "/_next/",
  "/favicon",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  // Auth-disabled mode: when ADMIN_PASSWORD is unset, leave the app open.
  // This keeps the demo seed flow usable before the operator configures auth.
  if (!process.env.ADMIN_PASSWORD || !process.env.AUTH_SECRET) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    const payload = await verifySession(token);
    if (payload) return NextResponse.next();
  }

  // Unauthenticated request to a protected route. API calls get a JSON 401;
  // page requests get redirected to /login (with ?next= so we can come back).
  if (pathname.startsWith("/api/")) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Run on everything except Next's internal asset paths.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
