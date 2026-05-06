import { logger, generateRequestId, REQUEST_ID_HEADER, truncateIp } from '@me/shared';

export interface Env {
  CONTROL_PLANE_URL: string;
  CONTROL_PLANE_TOKEN: string;
  TURNSTILE_SECRET?: string;
  ENVIRONMENT: string;
}

interface FormSubmission {
  slug: string;
  visitor_id: string;
  campaign_id?: string;
  ad_id?: string;
  fields: Record<string, string>;
  ts: number;
  turnstile_token?: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const request_id = request.headers.get(REQUEST_ID_HEADER) ?? generateRequestId();
    const corsHeaders = {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST,OPTIONS',
      'access-control-allow-headers': 'content-type',
      'access-control-max-age': '86400',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }
    const url = new URL(request.url);
    if (url.pathname !== '/submit') {
      return new Response('Not found', { status: 404, headers: corsHeaders });
    }

    let body: FormSubmission;
    try {
      body = (await request.json()) as FormSubmission;
    } catch {
      return new Response('Invalid JSON', { status: 400, headers: corsHeaders });
    }

    if (!body.slug || !body.visitor_id || !body.fields) {
      return new Response('Missing required fields', { status: 400, headers: corsHeaders });
    }

    if (env.TURNSTILE_SECRET) {
      const ok = await verifyTurnstile(body.turnstile_token ?? '', env.TURNSTILE_SECRET);
      if (!ok) {
        logger.warn({ service: 'lp-form', request_id, event: 'turnstile_failed', slug: body.slug });
        return new Response('Bot verification failed', { status: 403, headers: corsHeaders });
      }
    }

    const ip = request.headers.get('cf-connecting-ip') ?? '';
    const cf = (request as unknown as { cf?: IncomingRequestCfProperties }).cf;
    const enriched = {
      ...body,
      ip_truncated: ip ? truncateIp(ip) : undefined,
      country: cf?.country,
      ua: request.headers.get('user-agent'),
      referer: request.headers.get('referer'),
    };

    try {
      const res = await fetch(`${env.CONTROL_PLANE_URL}/api/leads`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${env.CONTROL_PLANE_TOKEN}`,
          [REQUEST_ID_HEADER]: request_id,
        },
        body: JSON.stringify(enriched),
      });
      if (!res.ok) {
        logger.error({
          service: 'lp-form',
          request_id,
          event: 'control_plane_failed',
          slug: body.slug,
          payload: { status: res.status },
        });
        return new Response('Submission failed', { status: 502, headers: corsHeaders });
      }
    } catch (err) {
      logger.error({
        service: 'lp-form',
        request_id,
        event: 'control_plane_error',
        slug: body.slug,
        payload: { error: String(err) },
      });
      return new Response('Submission failed', { status: 502, headers: corsHeaders });
    }

    logger.info({
      service: 'lp-form',
      request_id,
      event: 'form_submitted',
      slug: body.slug,
      visitor_id: body.visitor_id,
    });
    ctx.waitUntil(Promise.resolve());

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'content-type': 'application/json', [REQUEST_ID_HEADER]: request_id },
    });
  },
};

async function verifyTurnstile(token: string, secret: string): Promise<boolean> {
  if (!token) return false;
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: `secret=${encodeURIComponent(secret)}&response=${encodeURIComponent(token)}`,
    });
    const data = (await res.json()) as { success: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
