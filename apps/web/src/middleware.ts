import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login'];
const SUPER_ADMIN_PATHS = ['/admin'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = request.cookies.get('token')?.value;
  const role = request.cookies.get('role')?.value;

  // Root redirect
  if (pathname === '/') {
    if (token) {
      return NextResponse.redirect(
        new URL(role === 'SUPER_ADMIN' ? '/admin' : '/dashboard', request.url)
      );
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Already logged-in users hitting /login
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    if (token) {
      return NextResponse.redirect(
        new URL(role === 'SUPER_ADMIN' ? '/admin' : '/dashboard', request.url)
      );
    }
    return NextResponse.next();
  }

  // All other routes require a token
  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Super admin pages are restricted
  if (SUPER_ADMIN_PATHS.some((p) => pathname.startsWith(p)) && role !== 'SUPER_ADMIN') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Client pages blocked for super admin
  const clientOnlyPaths = ['/dashboard', '/pos', '/items', '/invoices', '/customers', '/expenses', '/settings'];
  if (clientOnlyPaths.some((p) => pathname.startsWith(p)) && role === 'SUPER_ADMIN') {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
