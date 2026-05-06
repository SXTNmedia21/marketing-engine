#!/usr/bin/env bash
# Local bootstrap — no 1Password, plain .env with generated secrets.
# Run from infra/. Idempotent — re-run safe (skips existing .env).
set -euo pipefail

cd "$(dirname "$0")"

ENV_FILE=".env"
TEMPLATE=".env.example"

if [ ! -f "$TEMPLATE" ]; then
  echo "ERROR: $TEMPLATE not found" >&2
  exit 1
fi

if [ -f "$ENV_FILE" ]; then
  echo "[skip] $ENV_FILE exists — leaving as-is. Delete it to regenerate."
else
  echo "[gen]  Creating $ENV_FILE with generated secrets..."
  cp "$TEMPLATE" "$ENV_FILE"

  # 64-char hex (32 bytes) for *_SECRET / *_TOKEN / *_KEY (long)
  while grep -q "CHANGE_ME_64_CHAR_HEX" "$ENV_FILE"; do
    SECRET=$(openssl rand -hex 32)
    sed -i "0,/CHANGE_ME_64_CHAR_HEX/{s/CHANGE_ME_64_CHAR_HEX/$SECRET/}" "$ENV_FILE"
  done

  # 32-char hex (16 bytes) for shorter keys
  while grep -q "CHANGE_ME_32_CHAR_HEX" "$ENV_FILE"; do
    SECRET=$(openssl rand -hex 16)
    sed -i "0,/CHANGE_ME_32_CHAR_HEX/{s/CHANGE_ME_32_CHAR_HEX/$SECRET/}" "$ENV_FILE"
  done

  # Plain CHANGE_ME — passwords (alphanumeric, no special chars)
  while grep -qE "=CHANGE_ME$" "$ENV_FILE"; do
    PWD=$(openssl rand -base64 24 | tr -d '+/=' | head -c 32)
    sed -i "0,/=CHANGE_ME$/{s|=CHANGE_ME$|=$PWD|}" "$ENV_FILE"
  done

  # Swap example.com domains for *.local for local dev
  sed -i 's/example\.com/local/g' "$ENV_FILE"

  chmod 600 "$ENV_FILE"
  echo "[ok]   $ENV_FILE generated (chmod 600)"
fi

# Caddyfile: only swap if it still contains example.com
if grep -q "example\.com" caddy/Caddyfile 2>/dev/null; then
  echo "[gen]  Swapping example.com → .local in Caddyfile"
  sed -i 's/example\.com/local/g' caddy/Caddyfile
fi

# /etc/hosts hint
LOCAL_HOSTS=(crm.local n8n.local postiz.local api.local grafana.local minio.local)
MISSING=()
for h in "${LOCAL_HOSTS[@]}"; do
  if ! grep -q "$h" /etc/hosts 2>/dev/null; then
    MISSING+=("$h")
  fi
done
if [ ${#MISSING[@]} -gt 0 ]; then
  echo "[warn] /etc/hosts missing entries: ${MISSING[*]}"
  echo "       Add this line as root:"
  echo "       127.0.0.1 ${LOCAL_HOSTS[*]}"
fi

# Boot order: data tier → app tier → edge
echo "[up]   docker compose up -d postgres redis"
docker compose up -d postgres redis

echo "[wait] Postgres healthcheck (max 60s)..."
for i in {1..30}; do
  if docker compose exec -T postgres pg_isready -U "$(grep POSTGRES_USER "$ENV_FILE" | cut -d= -f2)" >/dev/null 2>&1; then
    echo "[ok]   Postgres ready"
    break
  fi
  sleep 2
done

echo "[up]   docker compose up -d twenty-server twenty-worker n8n postiz control-api"
docker compose up -d twenty-server twenty-worker n8n postiz control-api

echo "[up]   docker compose up -d minio loki promtail grafana caddy"
docker compose up -d minio loki promtail grafana caddy

echo
echo "==================================================================="
echo " UP. Service URLs (all https via Caddy local CA, accept the warn):"
echo "==================================================================="
echo "  Twenty CRM   https://crm.local"
echo "  n8n          https://n8n.local"
echo "  Postiz       https://postiz.local"
echo "  control-api  https://api.local/health"
echo "  Grafana      https://grafana.local"
echo "  MinIO        https://minio.local"
echo
echo "Next:"
echo "  1. Open https://n8n.local → Settings → API → create key"
echo "  2. cp ../.env.n8n.template ../.env.n8n.local"
echo "  3. Paste key in N8N_API_KEY"
echo "  4. Restart Claude Code to load .mcp.json"
echo
echo "Logs:   docker compose logs -f <service>"
echo "Down:   docker compose down"
echo "Reset:  docker compose down -v && rm $ENV_FILE  # nukes data"
