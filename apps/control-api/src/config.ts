import { z } from 'zod';

const ConfigSchema = z.object({
  env: z.enum(['development', 'staging', 'production']).default('development'),
  port: z.coerce.number().default(8080),
  database_url: z.string().min(1),
  control_plane_token: z.string().min(16),
  twenty_api_url: z.string().url(),
  twenty_api_token: z.string().min(1),
  loki_push_url: z.string().url().optional(),
});

export const config = ConfigSchema.parse({
  env: process.env.NODE_ENV,
  port: process.env.PORT,
  database_url: process.env.DATABASE_URL,
  control_plane_token: process.env.CONTROL_PLANE_TOKEN,
  twenty_api_url: process.env.TWENTY_API_URL,
  twenty_api_token: process.env.TWENTY_API_TOKEN,
  loki_push_url: process.env.LOKI_PUSH_URL,
});
