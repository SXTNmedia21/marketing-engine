import postgres from 'postgres';
import { config } from './config.js';

export const sql = postgres(config.database_url, {
  max: 20,
  idle_timeout: 30,
  connect_timeout: 5,
});

export async function initDb(): Promise<void> {
  await sql`SELECT 1`;
}
