-- Bootstrap databases for control plane services that share the main Postgres.
-- Postiz and Temporal have their own Postgres instances, not created here.
CREATE DATABASE "default";   -- Twenty CRM expects this name (per twenty-docker compose)
CREATE DATABASE n8n;
-- marketing_engine is created by POSTGRES_DB env var
