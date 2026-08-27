import { createHash } from 'crypto';
import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { createClient } from 'redis';

const CACHE_KEY_PREFIX = 'ddm:nest-backend:monitoring:v1';
const DEFAULT_TTL_SECONDS = 60;
const MAX_CACHE_VALUE_BYTES = 256 * 1024;

export const MONITORING_ALARMS_CACHE_KEY = `${CACHE_KEY_PREFIX}:alarms`;

export interface MonitoringCacheStatus {
  provider: 'redis';
  enabled: boolean;
  available: boolean;
  ttlSeconds: number;
}

export function monitoringMetricCacheKey(
  metricName: string,
  namespace: string,
  hours: number,
  period: number,
): string {
  const parameters = JSON.stringify({ metricName, namespace, hours, period });
  const digest = createHash('sha256').update(parameters).digest('hex');
  return `${CACHE_KEY_PREFIX}:metrics:${digest}`;
}

@Injectable()
export class MonitoringCacheService
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly logger = new Logger(MonitoringCacheService.name);
  private readonly enabled = process.env.REDIS_CACHE_ENABLED === 'true';
  private readonly ttlSeconds = this.readTTLSeconds();
  private readonly client?: ReturnType<typeof createClient>;
  private connectionErrorLogged = false;

  constructor() {
    if (!this.enabled) {
      return;
    }

    this.client = createClient({
      url: process.env.REDIS_URL,
      disableOfflineQueue: true,
      socket: {
        connectTimeout: 1_000,
        reconnectStrategy: (retries) =>
          Math.min(100 * 2 ** Math.min(retries, 4), 2_000),
      },
    });
    this.client.on('ready', () => {
      this.connectionErrorLogged = false;
      this.logger.log('Redis monitoring cache connected');
    });
    this.client.on('error', (error) => this.logConnectionError(error));
  }

  onModuleInit(): void {
    if (!this.client) {
      return;
    }

    // Redis is an optional performance layer. Connecting must not delay API
    // startup or make PostgreSQL-backed readiness depend on cache health.
    void this.client.connect().catch((error: unknown) => {
      this.logConnectionError(error);
    });
  }

  async onApplicationShutdown(): Promise<void> {
    if (!this.client?.isOpen) {
      return;
    }

    if (this.client.isReady) {
      await this.client.close();
      return;
    }

    this.client.destroy();
  }

  getStatus(): MonitoringCacheStatus {
    return {
      provider: 'redis',
      enabled: this.enabled,
      available: this.client?.isReady ?? false,
      ttlSeconds: this.ttlSeconds,
    };
  }

  async getJSON<T>(key: string): Promise<T | undefined> {
    if (!this.client?.isReady) {
      return undefined;
    }

    try {
      const value = await this.client.get(key);
      if (value === null) {
        return undefined;
      }
      return JSON.parse(value) as T;
    } catch (error) {
      this.logger.warn(
        `Redis monitoring cache read failed; using CloudWatch: ${this.errorMessage(error)}`,
      );
      return undefined;
    }
  }

  async setJSON(key: string, value: unknown): Promise<boolean> {
    if (!this.client?.isReady) {
      return false;
    }

    let serialized: string;
    try {
      serialized = JSON.stringify(value);
    } catch (error) {
      this.logger.warn(
        `Redis monitoring cache serialization failed: ${this.errorMessage(error)}`,
      );
      return false;
    }

    if (Buffer.byteLength(serialized, 'utf8') > MAX_CACHE_VALUE_BYTES) {
      this.logger.warn(
        `Redis monitoring cache value exceeds ${MAX_CACHE_VALUE_BYTES} bytes; value was not cached`,
      );
      return false;
    }

    try {
      await this.client.set(key, serialized, { EX: this.ttlSeconds });
      return true;
    } catch (error) {
      this.logger.warn(
        `Redis monitoring cache write failed; response remains available: ${this.errorMessage(error)}`,
      );
      return false;
    }
  }

  private readTTLSeconds(): number {
    const configured = Number(process.env.MONITORING_CACHE_TTL_SECONDS ?? '60');
    return Number.isSafeInteger(configured) && configured > 0
      ? configured
      : DEFAULT_TTL_SECONDS;
  }

  private logConnectionError(error: unknown): void {
    if (this.connectionErrorLogged) {
      return;
    }
    this.connectionErrorLogged = true;
    this.logger.warn(
      `Redis monitoring cache unavailable; continuing without cache: ${this.errorMessage(error)}`,
    );
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
