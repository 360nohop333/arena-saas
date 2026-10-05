import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge guard for authenticated routes.
 *
 * This is a fast first line of defence: it only checks that a session cookie is
 * present. The real authorisation happens on the server in
 * `getWorkspaceContext()`, which validates the session against the database on
 * every request — a forged cookie buys nothing.
 */

const PROTECTED_PREFIXES = ["/dashboard", "/projects", "/tasks", "/team", "/settings"];
const AUTH_PAGES = ["/login", "/signup", "/forgot-password"];

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const hasSession = Boolean(request.cookies.get("taskflow_session")?.value);

  if (!hasSession && PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  if (hasSession && AUTH_PAGES.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/projects/:path*",
    "/tasks/:path*",
    "/team/:path*",
    "/settings/:path*",
    "/login",
    "/signup",
    "/forgot-password",
  ],
};
