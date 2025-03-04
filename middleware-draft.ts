import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });

  // Protect /mail routes
  if (request.nextUrl.pathname.startsWith("/mail")) {
    if (!session) {
      // Redirect to login if not authenticated
      const loginUrl = new URL("/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

// Configure which routes to run middleware on
export const config = {
  matcher: ["/mail/:path*"],
};
