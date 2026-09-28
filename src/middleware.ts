// ============================================
// BiblioGest - Middleware de Autenticação
// ============================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Rotas liberadas sem autenticação
const PUBLIC_PATHS = [
  "/",
  "/auth/login",
  "/auth/register",
  "/catalog",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/logout",
  "/api/auth/me",
  "/api/auth/search",
];

/**
 * Endpoints de leitura que o catálogo público pode consultar.
 * Somente GET — escrita continua exigindo login.
 */
const PUBLIC_API_READS = ["/api/catalog", "/api/exemplars", "/api/settings"];

const isPublic = (pathname: string) =>
  PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

const isPublicRead = (pathname: string, method: string) =>
  method === "GET" && PUBLIC_API_READS.some((p) => pathname === p || pathname.startsWith(p + "/"));

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  if (isPublic(pathname) || isPublicRead(pathname, method)) {
    return NextResponse.next();
  }

  const token = request.cookies.get("token")?.value;

  if (!token) {
    const loginUrl = new URL("/auth/login", request.url);
    // Requisições de API recebem JSON; páginas recebem redirect
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Não autenticado" },
        { status: 401 }
      );
    }
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/:path*", "/auth/:path*"],
};
