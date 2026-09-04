import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const roleHome: Record<string, string> = {
  USER: "/dashboard",
  AGENT: "/agent",
  ADMIN: "/admin",
};

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const role = req.auth?.user?.role;

  const isAuthPage = nextUrl.pathname === "/login" || nextUrl.pathname === "/signup";
  const isPublic = nextUrl.pathname === "/" || isAuthPage;

  if (!isLoggedIn) {
    if (isPublic) return NextResponse.next();
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL(roleHome[role ?? "USER"], nextUrl));
  }

  if (nextUrl.pathname.startsWith("/admin") && role !== "ADMIN") {
    return NextResponse.redirect(new URL(roleHome[role ?? "USER"], nextUrl));
  }

  if (nextUrl.pathname.startsWith("/agent") && role !== "AGENT" && role !== "ADMIN") {
    return NextResponse.redirect(new URL(roleHome[role ?? "USER"], nextUrl));
  }

  if (nextUrl.pathname.startsWith("/dashboard") && role !== "USER") {
    return NextResponse.redirect(new URL(roleHome[role ?? "USER"], nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
