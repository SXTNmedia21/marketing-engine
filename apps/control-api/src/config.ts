import { z } from 'zod';

const ConfigSchema = z.object({
  env: z.enum(['development', 'staging', 'production']).default('development'),
  port: z.coerce.number().default(8080),
  database_url: z.string().min(1),
  control_plane_token: z.string().min(16),
  twenty_api_url: z.string().url(),
  twenty_api_token: z.string().min(1),
  loki_push_url: z.string().url().optional(),
  resend_api_key: z.string().min(1).optional(),
  resend_webhook_secret: z.string().min(1).optional(),
  email_default_from: z.string().email().optional(),
  livekit_url: z.string().url().optional(),
  livekit_api_key: z.string().min(1).optional(),
  livekit_api_secret: z.string().min(1).optional(),
  livekit_dispatch_endpoint: z.string().url().optional(),
  livekit_webhook_secret: z.string().min(1).optional(),
});

export const config = ConfigSchema.parse({
  env: process.env.NODE_ENV,
  port: process.env.PORT,
  database_url: process.env.DATABASE_URL,
  control_plane_token: process.env.CONTROL_PLANE_TOKEN,
  twenty_api_url: process.env.TWENTY_API_URL,
  twenty_api_token: process.env.TWENTY_API_TOKEN,
  loki_push_url: process.env.LOKI_PUSH_URL,
  resend_api_key: process.env.RESEND_API_KEY,
  resend_webhook_secret: process.env.RESEND_WEBHOOK_SECRET,
  email_default_from: process.env.EMAIL_DEFAULT_FROM,
  livekit_url: process.env.LIVEKIT_URL,
  livekit_api_key: process.env.LIVEKIT_API_KEY,
  livekit_api_secret: process.env.LIVEKIT_API_SECRET,
  livekit_dispatch_endpoint: process.env.LIVEKIT_DISPATCH_ENDPOINT,
  livekit_webhook_secret: process.env.LIVEKIT_WEBHOOK_SECRET,
});
