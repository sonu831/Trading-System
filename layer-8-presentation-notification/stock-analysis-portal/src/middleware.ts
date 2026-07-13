import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Injects the L7 service key into proxied API requests.
 *
 * next.config.js rewrites /api/v1|market|backfill/* to backend-api:4000, and L7 is now
 * default-deny (see layer-7 index.ts). This middleware runs SERVER-SIDE, so the key is
 * added after the browser request arrives and is never shipped to the client — hence
 * INTERNAL_API_KEY, not NEXT_PUBLIC_*. Putting the key in client code would hand the
 * trading control plane to anyone who opened devtools.
 *
 * Header name is `shared/constants.js` API_KEY_HEADER. Next middleware runs on the edge
 * runtime and cannot require() that CommonJS module, so the literal is asserted against
 * the shared constant by tests/verify-api-key-header.js instead.
 */
const API_KEY_HEADER = 'x-api-key';

export function middleware(request: NextRequest) {
  const key = process.env.INTERNAL_API_KEY;

  // Fail closed, and say WHY. Silently forwarding an unkeyed request just produces a bare
  // 401 from L7 with no clue that the dashboard's env is the actual problem.
  // Next reads env from THIS directory (.env.local) — not the monorepo root .env.
  if (!key) {
    console.error(
      '[middleware] INTERNAL_API_KEY is not set — every /api/* call will be rejected by the API.\n' +
        '  Local dev: add INTERNAL_API_KEY=<key from repo-root .env> to stock-analysis-portal/.env.local, then RESTART next.\n' +
        '  Docker:    docker compose up -d --force-recreate dashboard',
    );
    return NextResponse.json(
      { success: false, error: 'Dashboard misconfigured: INTERNAL_API_KEY is not set (see server logs).' },
      { status: 503 },
    );
  }

  const headers = new Headers(request.headers);
  // A client must never be able to present its own service key by setting the header.
  headers.delete(API_KEY_HEADER);
  headers.set(API_KEY_HEADER, key);

  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ['/api/v1/:path*', '/api/market/:path*', '/api/backfill/:path*'],
};
