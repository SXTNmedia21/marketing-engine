export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

export interface LogPayload {
  service: string;
  request_id?: string;
  event: string;
  payload?: Record<string, unknown>;
  visitor_id?: string;
  slug?: string;
  campaign_id?: string;
  latency_ms?: number;
}

export interface LogRecord extends LogPayload {
  ts: string;
  level: LogLevel;
}

export function log(level: LogLevel, payload: LogPayload): void {
  const record: LogRecord = {
    ts: new Date().toISOString(),
    level,
    ...payload,
  };
  const line = JSON.stringify(record);
  if (level === 'ERROR' || level === 'FATAL') {
    console.error(line);
  } else if (level === 'WARN') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (p: LogPayload) => log('DEBUG', p),
  info: (p: LogPayload) => log('INFO', p),
  warn: (p: LogPayload) => log('WARN', p),
  error: (p: LogPayload) => log('ERROR', p),
  fatal: (p: LogPayload) => log('FATAL', p),
};
