import { NextResponse, type NextRequest } from "next/server";

import { isPublicPage } from "@/lib/auth/public-paths";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public pages (the privacy notice) are served for every session state: no
  // login redirect for a visitor and no dashboard redirect for a signed-in user.
  if (isPublicPage(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;

  if (pathname === "/login" || pathname === "/register") {
    if (session) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (!session) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Todo salvo API, estáticos de Next y archivos con extensión (imágenes, etc.)
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)"],
};
