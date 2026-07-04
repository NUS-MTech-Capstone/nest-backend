import { randomUUID } from 'crypto';
import type { LoggerService, NestMiddleware } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';
const SERVICE = 'nest-backend';

function env(): string {
  return process.env.ENV || process.env.DDM_ENV || 'dev';
}

function json(level: string, message: unknown, context?: string, extra: Record<string, unknown> = {}): void {
  const payload = {
    time: new Date().toISOString(),
    level,
    service: SERVICE,
    env: env(),
    context,
    msg: String(message),
    ...extra,
  };
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

export class JsonLogger implements LoggerService {
  log(message: unknown, context?: string): void {
    json('info', message, context);
  }

  error(message: unknown, trace?: string, context?: string): void {
    json('error', message, context, trace ? { trace } : {});
  }

  warn(message: unknown, context?: string): void {
    json('warn', message, context);
  }

  debug(message: unknown, context?: string): void {
    json('debug', message, context);
  }

  verbose(message: unknown, context?: string): void {
    json('debug', message, context);
  }
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const requestId =
      String(req.headers[REQUEST_ID_HEADER] ?? '').trim() || randomUUID();
    req.headers[REQUEST_ID_HEADER] = requestId;
    res.setHeader(REQUEST_ID_HEADER, requestId);
    const started = Date.now();
    res.on('finish', () => {
      json('info', 'http_request', 'HttpRequest', {
        requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Date.now() - started,
      });
    });
    next();
  }
}

export function requestIdFrom(req: Request): string {
  return String(req.headers[REQUEST_ID_HEADER] ?? '');
}

export function emitMetric(
  metrics: Array<{ name: string; unit?: string; value: number }>,
  dimensions: Record<string, string> = {},
): void {
  if (metrics.length === 0) return;
  const payload: Record<string, unknown> = {
    Service: SERVICE,
    Environment: env(),
  };
  for (const [key, value] of Object.entries(dimensions)) {
    if (value) payload[key] = value;
  }
  for (const metric of metrics) {
    payload[metric.name] = metric.value;
  }
  payload._aws = {
    Timestamp: Date.now(),
    CloudWatchMetrics: [
      {
        Namespace: process.env.CLOUDWATCH_NAMESPACE || 'DenDenMushi',
        Dimensions: [['Service', 'Environment']],
        Metrics: metrics.map((metric) => ({
          Name: metric.name,
          Unit: metric.unit || 'Count',
        })),
      },
    ],
  };
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

export function emitCount(name: string, dimensions: Record<string, string> = {}): void {
  emitMetric([{ name, unit: 'Count', value: 1 }], dimensions);
}

export function errorKind(err: unknown): string {
  if (err instanceof Error && err.name) return err.name;
  return 'error';
}
