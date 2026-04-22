import { NextRequest, NextResponse } from "next/server";

const locales = ["uz", "ru"] as const;
const defaultLocale = "uz";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static/internal paths
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Redirect root to default locale
  if (pathname === "/") {
    return NextResponse.redirect(
      new URL(`/${defaultLocale}`, request.url),
      308,
    );
  }

  // Check if path has a valid locale prefix
  const pathnameLocale = pathname.split("/")[1];
  if (!locales.includes(pathnameLocale as (typeof locales)[number])) {
    return NextResponse.redirect(
      new URL(`/${defaultLocale}${pathname}`, request.url),
      308,
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
