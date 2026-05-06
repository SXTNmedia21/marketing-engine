import { parseLpConfig } from '@me/lp-config';
import { renderLp } from '@me/templates';
import { logger, generateRequestId, REQUEST_ID_HEADER } from '@me/shared';

export interface Env {
  LP_CONFIGS: KVNamespace;
  EVENTS_ENDPOINT: string;
  FORM_ENDPOINT: string;
  ENVIRONMENT: string;
}

const VISITOR_COOKIE = '_me_vid';
const VISITOR_TTL_DAYS = 365;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const request_id = request.headers.get(REQUEST_ID_HEADER) ?? generateRequestId();
    const start = Date.now();

    const match = url.pathname.match(/^\/lp\/([a-z0-9-]+)$/);
    if (!match) {
      return new Response('Not found', { status: 404 });
    }
    const slug = match[1]!;

    const raw = await env.LP_CONFIGS.get(`lp:${slug}`, 'json');
    if (!raw) {
      logger.warn({ service: 'lp-render', request_id, event: 'kv_miss', slug });
      return new Response('LP not found', { status: 404 });
    }

    const parsed = parseLpConfig(raw);
    if (parsed.status !== 'active') {
      return new Response('LP not active', { status: 410 });
    }

    const visitor_id = getOrCreateVisitorId(request);
    const html = renderLp(parsed, {
      request_id,
      visitor_id: visitor_id.value,
      events_endpoint: env.EVENTS_ENDPOINT,
      form_endpoint: env.FORM_ENDPOINT,
    });

    const headers = new Headers({
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'strict-origin-when-cross-origin',
      'content-security-policy': buildCsp(),
      [REQUEST_ID_HEADER]: request_id,
    });
    if (visitor_id.isNew) {
      headers.append(
        'set-cookie',
        `${VISITOR_COOKIE}=${visitor_id.value}; Path=/; Max-Age=${VISITOR_TTL_DAYS * 86400}; HttpOnly; Secure; SameSite=Lax`,
      );
    }

    logger.info({
      service: 'lp-render',
      request_id,
      event: 'lp_served',
      slug,
      visitor_id: visitor_id.value,
      latency_ms: Date.now() - start,
    });

    ctx.waitUntil(Promise.resolve());
    return new Response(html, { headers });
  },
};

function getOrCreateVisitorId(request: Request): { value: string; isNew: boolean } {
  const cookie = request.headers.get('cookie') ?? '';
  const match = cookie.match(new RegExp(`${VISITOR_COOKIE}=([^;]+)`));
  if (match?.[1]) return { value: match[1], isNew: false };
  return { value: crypto.randomUUID(), isNew: true };
}

function buildCsp(): string {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "connect-src 'self' https:",
    "font-src 'self' data:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}
