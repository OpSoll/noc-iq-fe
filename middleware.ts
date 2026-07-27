import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const nonce = Buffer.from(
    crypto.randomUUID(),
  ).toString('base64');

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ');

  const requestHeaders = new Headers(
    request.headers,
  );

  requestHeaders.set(
    'x-nonce',
    nonce,
  );

  requestHeaders.set(
    'Content-Security-Policy',
    csp,
  );

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set(
    'Content-Security-Policy',
    csp,
  );

  response.headers.set(
    'X-Frame-Options',
    'DENY',
  );

  response.headers.set(
    'X-Content-Type-Options',
    'nosniff',
  );

  response.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains',
  );

  return response;
}

export const config = {
  matcher: [
    /*
     * Run middleware for application routes while
     * excluding static assets and Next.js internals.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)',
  ],
};