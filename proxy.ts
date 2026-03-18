import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  // Skip auth for the login page itself and static assets
  const { pathname } = request.nextUrl;
if (pathname.startsWith("/login") || pathname.startsWith("/api/auth") || pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
  return NextResponse.next();
}

  const session = request.cookies.get("dashboard_session")?.value;
  if (session === process.env.SESSION_SECRET) {
    return NextResponse.next();
  }

  // Redirect to login
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
