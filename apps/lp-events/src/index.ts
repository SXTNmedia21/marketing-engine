import { logger, generateRequestId, REQUEST_ID_HEADER, truncateIp } from '@me/shared';

export interface Env {
  CONTROL_PLANE_URL: string;
  CONTROL_PLANE_TOKEN: string;
  LOKI_PUSH_URL?: string;
  LOKI_AUTH?: string;
  ENVIRONMENT: string;
}

interface IncomingEvent {
  type: string;
  slug: string;
  visitor_id: string;
  campaign_id?: string;
  ad_id?: string;
  variant?: string;
  ts: number;
  payload?: Record<string, unknown>;
}

const RATE_LIMIT_PER_MIN = 120;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const request_id = request.headers.get(REQUEST_ID_HEADER) ?? generateRequestId();

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }
    const url = new URL(request.url);
    if (url.pathname !== '/events') {
      return new Response('Not found', { status: 404 });
    }

    let body: IncomingEvent | IncomingEvent[];
    try {
      body = await request.json();
    } catch {
      return new Response('Invalid JSON', { status: 400 });
    }
    const events = Array.isArray(body) ? body : [body];
    if (events.length === 0 || events.length > 100) {
      return new Response('Invalid batch size', { status: 400 });
    }

    const cf = (request as unknown as { cf?: IncomingRequestCfProperties }).cf;
    const ip = request.headers.get('cf-connecting-ip') ?? '';
    const enriched = events.map((e) => ({
      ...e,
      ip_truncated: ip ? truncateIp(ip) : undefined,
      country: cf?.country,
      city: cf?.city,
      region: cf?.region,
      colo: cf?.colo,
      ua: request.headers.get('user-agent') ?? undefined,
    }));

    ctx.waitUntil(forwardToControlPlane(enriched, env, request_id));
    if (env.LOKI_PUSH_URL) {
      ctx.waitUntil(forwardToLoki(enriched, env, request_id));
    }

    return new Response(null, {
      status: 204,
      headers: { [REQUEST_ID_HEADER]: request_id },
    });
  },
};

async function forwardToControlPlane(
  events: unknown[],
  env: Env,
  request_id: string,
): Promise<void> {
  try {
    const res = await fetch(`${env.CONTROL_PLANE_URL}/api/events`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${env.CONTROL_PLANE_TOKEN}`,
        [REQUEST_ID_HEADER]: request_id,
      },
      body: JSON.stringify({ events }),
    });
    if (!res.ok) {
      logger.error({
        service: 'lp-events',
        request_id,
        event: 'control_plane_failed',
        payload: { status: res.status },
      });
    }
  } catch (err) {
    logger.error({
      service: 'lp-events',
      request_id,
      event: 'control_plane_error',
      payload: { error: String(err) },
    });
  }
}

async function forwardToLoki(events: unknown[], env: Env, request_id: string): Promise<void> {
  if (!env.LOKI_PUSH_URL) return;
  const ts = `${Date.now()}000000`;
  const stream = {
    streams: [
      {
        stream: { service: 'lp-events', env: env.ENVIRONMENT },
        values: events.map((e) => [ts, JSON.stringify(e)]),
      },
    ],
  };
  try {
    await fetch(env.LOKI_PUSH_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(env.LOKI_AUTH ? { authorization: env.LOKI_AUTH } : {}),
      },
      body: JSON.stringify(stream),
    });
  } catch (err) {
    logger.error({
      service: 'lp-events',
      request_id,
      event: 'loki_error',
      payload: { error: String(err) },
    });
  }
}
