/**
 * kv-push.ts — Push active LP configs from Postgres to Cloudflare KV.
 *
 * Usage:
 *   pnpm --filter @me/scripts kv-push -- [--dry-run] [--slug <slug>] [--all] [--concurrency <n>]
 *
 * Exit codes:
 *   0  all-success
 *   1  partial-failure (some pushed, some failed)
 *   2  fatal (config/env error)
 */

import { createHash } from 'node:crypto';
import postgres from 'postgres';
import { z } from 'zod';
import { parseLpConfig } from '@me/lp-config';
import { logger, generateRequestId } from '@me/shared';

// ---------------------------------------------------------------------------
// Environment schema — fail-fast on missing
// ---------------------------------------------------------------------------
const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  CLOUDFLARE_ACCOUNT_ID: z.string().min(1),
  CLOUDFLARE_API_TOKEN: z.string().min(1),
  CLOUDFLARE_KV_NAMESPACE_ID: z.string().min(1),
  ENVIRONMENT: z.enum(['dev', 'staging', 'prod']),
});

type Env = z.infer<typeof EnvSchema>;

function loadEnv(): Env {
  const result = EnvSchema.safeParse({
    DATABASE_URL: process.env['DATABASE_URL'],
    CLOUDFLARE_ACCOUNT_ID: process.env['CLOUDFLARE_ACCOUNT_ID'],
    CLOUDFLARE_API_TOKEN: process.env['CLOUDFLARE_API_TOKEN'],
    CLOUDFLARE_KV_NAMESPACE_ID: process.env['CLOUDFLARE_KV_NAMESPACE_ID'],
    ENVIRONMENT: process.env['ENVIRONMENT'],
  });

  if (!result.success) {
    const missing = result.error.issues.map((i) => i.path.join('.')).join(', ');
    logger.fatal({
      service: 'kv-push',
      event: 'env_validation_failed',
      payload: { missing },
    });
    process.exit(2);
  }
  return result.data;
}

// ---------------------------------------------------------------------------
// CLI flags
// ---------------------------------------------------------------------------
interface CliFlags {
  dryRun: boolean;
  slug: string | null;
  all: boolean;
  concurrency: number;
}

function parseArgs(argv: string[]): CliFlags {
  const args = argv.slice(2);
  const flags: CliFlags = { dryRun: false, slug: null, all: false, concurrency: 5 };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--dry-run') flags.dryRun = true;
    else if (arg === '--all') flags.all = true;
    else if (arg === '--slug' && args[i + 1]) {
      flags.slug = args[++i] ?? null;
    } else if (arg === '--concurrency' && args[i + 1]) {
      const n = parseInt(args[++i] ?? '5', 10);
      if (!Number.isNaN(n) && n > 0) flags.concurrency = n;
    }
  }

  return flags;
}

// ---------------------------------------------------------------------------
// Inline semaphore (no extra dep)
// ---------------------------------------------------------------------------
function createSemaphore(concurrency: number) {
  let active = 0;
  const queue: Array<() => void> = [];

  function release() {
    active--;
    const next = queue.shift();
    if (next) {
      active++;
      next();
    }
  }

  function acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      if (active < concurrency) {
        active++;
        resolve(release);
      } else {
        queue.push(() => resolve(release));
      }
    });
  }

  return { acquire };
}

// ---------------------------------------------------------------------------
// Cloudflare KV REST client
// ---------------------------------------------------------------------------
const KV_BASE = 'https://api.cloudflare.com/client/v4';
const MAX_KV_BYTES = 25 * 1024 * 1024; // 25 MB hard limit
const WARN_KV_BYTES = 1 * 1024 * 1024; // 1 MB warn threshold
const PUSH_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 5;
const BASE_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function kvPut(
  env: Env,
  key: string,
  value: string,
  requestId: string,
): Promise<{ ok: boolean; error?: string }> {
  const url = `${KV_BASE}/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${env.CLOUDFLARE_KV_NAMESPACE_ID}/values/${encodeURIComponent(key)}`;
  const bytes = Buffer.byteLength(value, 'utf8');

  if (bytes > MAX_KV_BYTES) {
    return { ok: false, error: `KV value exceeds 25 MB hard limit (${bytes} bytes)` };
  }

  if (bytes > WARN_KV_BYTES) {
    logger.warn({
      service: 'kv-push',
      request_id: requestId,
      event: 'kv_value_large',
      payload: { key, bytes },
    });
  }

  let attempt = 0;
  while (attempt <= MAX_RETRIES) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PUSH_TIMEOUT_MS);

    try {
      const resp = await fetch(url, {
        method: 'PUT',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
        },
        body: value,
      });

      clearTimeout(timeoutId);

      if (resp.ok) {
        return { ok: true };
      }

      if (resp.status === 429 || resp.status >= 500) {
        const backoff = Math.min(BASE_BACKOFF_MS * Math.pow(2, attempt), MAX_BACKOFF_MS);
        logger.warn({
          service: 'kv-push',
          request_id: requestId,
          event: 'kv_push_retry',
          payload: { key, status: resp.status, attempt, backoff_ms: backoff },
        });
        await sleep(backoff);
        attempt++;
        continue;
      }

      const body = await resp.text().catch(() => '');
      return { ok: false, error: `HTTP ${resp.status}: ${body.slice(0, 256)}` };
    } catch (err) {
      clearTimeout(timeoutId);
      const isAbort = err instanceof Error && err.name === 'AbortError';
      if (isAbort || attempt >= MAX_RETRIES) {
        return {
          ok: false,
          error: isAbort ? `Timeout after ${PUSH_TIMEOUT_MS}ms` : String(err),
        };
      }
      const backoff = Math.min(BASE_BACKOFF_MS * Math.pow(2, attempt), MAX_BACKOFF_MS);
      await sleep(backoff);
      attempt++;
    }
  }

  return { ok: false, error: 'Max retries exceeded' };
}

// ---------------------------------------------------------------------------
// DB types
// ---------------------------------------------------------------------------
interface LpPageRow {
  id: string;
  slug: string;
  version: number;
  config: unknown;
  updated_at: Date | null;
  kv_synced_at: Date | null;
}

// ---------------------------------------------------------------------------
// Audit helpers
// ---------------------------------------------------------------------------
function hashAccountId(accountId: string): string {
  return createHash('sha256').update(accountId).digest('hex').slice(0, 16);
}

type AuditStatus = 'pushed' | 'failed' | 'validation_failed' | 'dry_run';

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  const env = loadEnv();
  const flags = parseArgs(process.argv);
  const sessionRequestId = generateRequestId();
  const accountIdHash = hashAccountId(env.CLOUDFLARE_ACCOUNT_ID);

  logger.info({
    service: 'kv-push',
    request_id: sessionRequestId,
    event: 'session_start',
    payload: {
      dry_run: flags.dryRun,
      slug: flags.slug,
      all: flags.all,
      concurrency: flags.concurrency,
      environment: env.ENVIRONMENT,
    },
  });

  // Connect to Postgres
  const sql = postgres(env.DATABASE_URL, {
    max: 10,
    idle_timeout: 30,
    connect_timeout: 5,
  });

  // Verify DB connection — fail fast with clear error
  try {
    await sql`SELECT 1`;
  } catch (err) {
    logger.fatal({
      service: 'kv-push',
      request_id: sessionRequestId,
      event: 'db_connect_failed',
      payload: { error: String(err) },
    });
    await sql.end();
    process.exit(2);
  }

  // Verify that 04-kv-sync.sql has been applied before proceeding.
  // The inline ALTER TABLE was removed (H1): the migration is the single source
  // of truth for the schema, including the correct CHECK constraint that includes
  // 'pending' (which the inline ALTER was missing).
  const migrationCheck = await sql<{ column_name: string }[]>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'lp_pages'
      AND column_name = 'kv_synced_at'
  `;
  if (migrationCheck.length === 0) {
    logger.fatal({
      service: 'kv-push',
      request_id: sessionRequestId,
      event: 'migration_missing',
      payload: { message: 'Run infra/postgres/init/04-kv-sync.sql before using kv-push.ts.' },
    });
    await sql.end();
    process.exit(2);
  }

  // Query candidates
  let rows: LpPageRow[];
  try {
    if (flags.slug) {
      rows = await sql<LpPageRow[]>`
        SELECT id, slug, version, config,
               updated_at, kv_synced_at
        FROM lp_pages
        WHERE slug = ${flags.slug}
          AND status = 'active'
      `;
      if (rows.length === 0) {
        logger.warn({
          service: 'kv-push',
          request_id: sessionRequestId,
          event: 'slug_not_found',
          payload: { slug: flags.slug },
        });
        await sql.end();
        process.exit(0);
      }
    } else if (flags.all) {
      rows = await sql<LpPageRow[]>`
        SELECT id, slug, version, config,
               updated_at, kv_synced_at
        FROM lp_pages
        WHERE status = 'active'
        ORDER BY slug
      `;
    } else {
      // Default: only unsynced or updated-since-last-sync
      rows = await sql<LpPageRow[]>`
        SELECT id, slug, version, config,
               updated_at, kv_synced_at
        FROM lp_pages
        WHERE status = 'active'
          AND (
            kv_synced_at IS NULL
            OR (updated_at IS NOT NULL AND updated_at > kv_synced_at)
          )
        ORDER BY slug
      `;
    }
  } catch (err) {
    logger.fatal({
      service: 'kv-push',
      request_id: sessionRequestId,
      event: 'db_query_failed',
      payload: { error: String(err) },
    });
    await sql.end();
    process.exit(2);
  }

  logger.info({
    service: 'kv-push',
    request_id: sessionRequestId,
    event: 'candidates_found',
    payload: { count: rows.length },
  });

  if (rows.length === 0) {
    logger.info({
      service: 'kv-push',
      request_id: sessionRequestId,
      event: 'nothing_to_push',
    });
    await sql.end();
    process.exit(0);
  }

  // Process in batches of 100
  const BATCH_SIZE = 100;
  const sem = createSemaphore(flags.concurrency);
  let successCount = 0;
  let failCount = 0;

  for (let batchStart = 0; batchStart < rows.length; batchStart += BATCH_SIZE) {
    const batch = rows.slice(batchStart, batchStart + BATCH_SIZE);

    const tasks = batch.map((row) =>
      sem.acquire().then(async (release) => {
        const requestId = generateRequestId();
        let auditStatus: AuditStatus = 'pushed';
        let auditError: string | null = null;

        try {
          // 1. Validate config
          let config: ReturnType<typeof parseLpConfig>;
          try {
            config = parseLpConfig(row.config);
          } catch (err) {
            auditStatus = 'validation_failed';
            auditError = String(err).slice(0, 1024);
            logger.error({
              service: 'kv-push',
              request_id: requestId,
              slug: row.slug,
              event: 'config_validation_failed',
              payload: { error: auditError },
            });
            failCount++;

            // Write audit row even on validation failure
            await writeAudit(sql, {
              slug: row.slug,
              version: row.version,
              status: auditStatus,
              error: auditError,
              requestId,
              namespaceId: env.CLOUDFLARE_KV_NAMESPACE_ID,
              accountIdHash,
            });

            // Update kv_sync_status = 'failed' even on validation failure
            if (!flags.dryRun) {
              await sql`
                UPDATE lp_pages
                SET kv_sync_status = 'failed'
                WHERE id = ${row.id}
              `;
            }
            return;
          }

          const key = `lp:${config.slug}`;
          const body = JSON.stringify(config);

          if (flags.dryRun) {
            auditStatus = 'dry_run';
            logger.info({
              service: 'kv-push',
              request_id: requestId,
              slug: row.slug,
              event: 'dry_run_push',
              payload: { key, bytes: Buffer.byteLength(body, 'utf8') },
            });
          } else {
            // 2. Push to KV
            const result = await kvPut(env, key, body, requestId);
            if (!result.ok) {
              auditStatus = 'failed';
              auditError = result.error ?? null;
              logger.error({
                service: 'kv-push',
                request_id: requestId,
                slug: row.slug,
                event: 'kv_push_failed',
                payload: { key, error: auditError },
              });
              failCount++;

              await sql`
                UPDATE lp_pages
                SET kv_sync_status = 'failed'
                WHERE id = ${row.id}
              `;
            } else {
              logger.info({
                service: 'kv-push',
                request_id: requestId,
                slug: row.slug,
                event: 'kv_push_success',
                payload: { key },
              });
              successCount++;

              // 3. Update kv_synced_at + kv_sync_status
              await sql`
                UPDATE lp_pages
                SET kv_synced_at   = now(),
                    kv_sync_status = 'synced'
                WHERE id = ${row.id}
              `;
            }
          }

          // Write audit row
          await writeAudit(sql, {
            slug: row.slug,
            version: row.version,
            status: auditStatus,
            error: auditError,
            requestId,
            namespaceId: env.CLOUDFLARE_KV_NAMESPACE_ID,
            accountIdHash,
          });

          if (flags.dryRun) successCount++;
        } catch (err) {
          auditStatus = 'failed';
          auditError = String(err).slice(0, 1024);
          logger.error({
            service: 'kv-push',
            request_id: requestId,
            slug: row.slug,
            event: 'push_error',
            payload: { error: auditError },
          });
          failCount++;

          await writeAudit(sql, {
            slug: row.slug,
            version: row.version,
            status: auditStatus,
            error: auditError,
            requestId,
            namespaceId: env.CLOUDFLARE_KV_NAMESPACE_ID,
            accountIdHash,
          }).catch(() => {
            /* audit write failure is non-fatal */
          });
        } finally {
          release();
        }
      }),
    );

    await Promise.all(tasks);
  }

  logger.info({
    service: 'kv-push',
    request_id: sessionRequestId,
    event: 'session_end',
    payload: { success: successCount, failed: failCount },
  });

  await sql.end();

  if (failCount > 0 && successCount > 0) process.exit(1);
  if (failCount > 0 && successCount === 0) process.exit(1);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Audit writer
// ---------------------------------------------------------------------------
interface AuditParams {
  slug: string;
  version: number;
  status: AuditStatus;
  error: string | null;
  requestId: string;
  namespaceId: string;
  accountIdHash: string;
}

async function writeAudit(
  sql: ReturnType<typeof postgres>,
  params: AuditParams,
): Promise<void> {
  await sql`
    INSERT INTO lp_kv_pushes
      (slug, version, status, error, request_id, kv_namespace_id, account_id_hash)
    VALUES
      (${params.slug},
       ${params.version},
       ${params.status},
       ${params.error ?? null},
       ${params.requestId},
       ${params.namespaceId},
       ${params.accountIdHash})
  `;
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
main().catch((err: unknown) => {
  logger.fatal({
    service: 'kv-push',
    event: 'unhandled_error',
    payload: { error: String(err) },
  });
  process.exit(2);
});
