import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { logger, generateRequestId, REQUEST_ID_HEADER } from '@me/shared';
import { eventsRoute } from './routes/events.js';
import { leadsRoute } from './routes/leads.js';
import { lpRoute } from './routes/lp.js';
import { healthRoute } from './routes/health.js';
import { emailWebhookRoute } from './routes/email-webhook.js';
import { voiceWebhookRoute } from './routes/voice-webhook.js';
import { config } from './config.js';
import { initDb } from './db.js';

async function main() {
  const app = Fastify({
    logger: false,
    trustProxy: true,
    bodyLimit: 1024 * 1024,
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  app.addHook('onRequest', async (req, reply) => {
    const id = (req.headers[REQUEST_ID_HEADER] as string) ?? generateRequestId();
    (req as unknown as { request_id: string }).request_id = id;
    reply.header(REQUEST_ID_HEADER, id);
  });

  await initDb();

  await app.register(healthRoute);
  await app.register(eventsRoute, { prefix: '/api' });
  await app.register(leadsRoute, { prefix: '/api' });
  await app.register(lpRoute, { prefix: '/api' });
  await app.register(emailWebhookRoute, { prefix: '/webhooks' });
  await app.register(voiceWebhookRoute, { prefix: '/webhooks' });

  try {
    await app.listen({ host: '0.0.0.0', port: config.port });
    logger.info({
      service: 'control-api',
      event: 'server_started',
      payload: { port: config.port, env: config.env },
    });
  } catch (err) {
    logger.fatal({
      service: 'control-api',
      event: 'server_failed',
      payload: { error: String(err) },
    });
    process.exit(1);
  }
}

main();
