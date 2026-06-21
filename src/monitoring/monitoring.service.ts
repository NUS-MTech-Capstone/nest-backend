import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import {
  CloudWatchClient,
  DescribeAlarmsCommand,
  GetMetricStatisticsCommand,
  type MetricAlarm,
} from '@aws-sdk/client-cloudwatch';
import {
  CloudWatchLogsClient,
  FilterLogEventsCommand,
} from '@aws-sdk/client-cloudwatch-logs';
import { AlertEvent } from './alert-event.entity';

export interface AlarmSummary {
  name: string;
  state: 'ALARM' | 'OK' | 'INSUFFICIENT_DATA';
  description?: string;
  metric: string;
  namespace: string;
  threshold?: number;
  updatedAt: string;
}

export interface MetricDataPoint {
  timestamp: string;
  value: number;
}

export interface MetricSummary {
  name: string;
  namespace: string;
  unit: string;
  dataPoints: MetricDataPoint[];
  current?: number;
}

export interface LogEvent {
  timestamp: string;
  message: string;
  logStream: string;
}

export interface MonitoringStatus {
  configured: boolean;
  region?: string;
  logGroup?: string;
  sessionLogGroup?: string;
  /** False after the first AWS AccessDenied response from CloudWatch/Logs. */
  awsAuthorized?: boolean;
  authorizationHint?: string;
}

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);
  private readonly region: string;
  private readonly logGroup: string;
  private readonly sessionLogGroup: string;
  private readonly namespace: string;
  private readonly configured: boolean;

  private cloudwatch: CloudWatchClient | null = null;
  private cwLogs: CloudWatchLogsClient | null = null;
  private authorizationFailed = false;
  private authorizationHint?: string;

  constructor(
    @InjectModel(AlertEvent)
    private alertEventModel: typeof AlertEvent,
  ) {
    this.region = process.env.CLOUDWATCH_REGION ?? process.env.AWS_REGION ?? '';
    this.logGroup = process.env.CLOUDWATCH_LOG_GROUP ?? '';
    this.sessionLogGroup = process.env.CLOUDWATCH_SESSION_LOG_GROUP ?? process.env.CLOUDWATCH_LOG_GROUP ?? '';
    this.namespace = process.env.CLOUDWATCH_NAMESPACE ?? 'DenDenMushi';
    this.configured = Boolean(this.region);

    if (this.configured) {
      this.cloudwatch = new CloudWatchClient({ region: this.region });
      this.cwLogs = new CloudWatchLogsClient({ region: this.region });
      this.logger.log(`CloudWatch configured: region=${this.region}, namespace=${this.namespace}`);
    } else {
      this.logger.warn('CloudWatch not configured (CLOUDWATCH_REGION not set) — monitoring endpoints will return empty data');
    }
  }

  getStatus(): MonitoringStatus {
    return {
      configured: this.configured,
      region: this.region || undefined,
      logGroup: this.logGroup || undefined,
      sessionLogGroup: this.sessionLogGroup || undefined,
      awsAuthorized: this.configured ? !this.authorizationFailed : undefined,
      authorizationHint: this.authorizationFailed ? this.authorizationHint : undefined,
    };
  }

  private isAccessDenied(err: unknown): boolean {
    const name = (err as { name?: string })?.name ?? '';
    return name === 'AccessDenied' || name === 'AccessDeniedException';
  }

  private noteAuthorizationFailure(err: unknown, action: string): void {
    if (!this.isAccessDenied(err)) {
      this.logger.error(`Failed to ${action}: ${err}`);
      return;
    }

    if (!this.authorizationFailed) {
      this.authorizationFailed = true;
      this.authorizationHint =
        'Attach CloudWatch read permissions to the nest-backend IAM role (logs:FilterLogEvents, cloudwatch:GetMetricStatistics, cloudwatch:DescribeAlarms).';
      this.logger.warn(
        `CloudWatch access denied — ${this.authorizationHint} First failure while ${action}.`,
      );
      return;
    }

    this.logger.debug(`CloudWatch access denied while ${action}`);
  }

  // ── Alarms ────────────────────────────────────────────────────────────────

  async getAlarms(): Promise<AlarmSummary[]> {
    if (!this.cloudwatch) return [];

    try {
      const result = await this.cloudwatch.send(new DescribeAlarmsCommand({}));
      return (result.MetricAlarms ?? []).map((a: MetricAlarm) => ({
        name: a.AlarmName ?? 'Unknown',
        state: (a.StateValue ?? 'INSUFFICIENT_DATA') as AlarmSummary['state'],
        description: a.AlarmDescription,
        metric: a.MetricName ?? '',
        namespace: a.Namespace ?? '',
        threshold: a.Threshold,
        updatedAt: a.StateUpdatedTimestamp?.toISOString() ?? new Date().toISOString(),
      }));
    } catch (err) {
      this.noteAuthorizationFailure(err, 'fetch CloudWatch alarms');
      return [];
    }
  }

  // ── Metrics ───────────────────────────────────────────────────────────────

  async getMetrics(
    metricName: string,
    namespace: string,
    hours = 24,
    period = 3600,
  ): Promise<MetricSummary> {
    if (!this.cloudwatch) {
      return { name: metricName, namespace, unit: 'Count', dataPoints: [] };
    }

    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - hours * 3_600_000);

    try {
      const result = await this.cloudwatch.send(
        new GetMetricStatisticsCommand({
          Namespace: namespace,
          MetricName: metricName,
          StartTime: startTime,
          EndTime: endTime,
          Period: period,
          Statistics: ['Sum', 'Average'],
        }),
      );

      const sorted = (result.Datapoints ?? [])
        .filter((d) => d.Timestamp)
        .sort((a, b) => a.Timestamp!.getTime() - b.Timestamp!.getTime());

      const dataPoints: MetricDataPoint[] = sorted.map((d) => ({
        timestamp: d.Timestamp!.toISOString(),
        value: d.Sum ?? d.Average ?? 0,
      }));

      const current = dataPoints.at(-1)?.value;

      return {
        name: metricName,
        namespace,
        unit: result.Datapoints?.[0]?.Unit ?? 'Count',
        dataPoints,
        current,
      };
    } catch (err) {
      this.noteAuthorizationFailure(err, `fetch metric ${metricName}`);
      return { name: metricName, namespace, unit: 'Count', dataPoints: [] };
    }
  }

  // ── Logs ─────────────────────────────────────────────────────────────────

  async getApplicationLogs(limit = 100, filterPattern?: string): Promise<LogEvent[]> {
    return this.queryLogs(this.logGroup, limit, filterPattern);
  }

  async getSessionLogs(limit = 100, filterPattern?: string): Promise<LogEvent[]> {
    const pattern = filterPattern ?? 'session';
    return this.queryLogs(this.sessionLogGroup, limit, pattern);
  }

  private async queryLogs(
    logGroupName: string,
    limit: number,
    filterPattern?: string,
  ): Promise<LogEvent[]> {
    if (!this.cwLogs || !logGroupName) return [];

    const endTime = Date.now();
    const startTime = endTime - 24 * 3_600_000;

    try {
      const result = await this.cwLogs.send(
        new FilterLogEventsCommand({
          logGroupName,
          startTime,
          endTime,
          limit,
          filterPattern: filterPattern || undefined,
        }),
      );

      return (result.events ?? []).map((e) => ({
        timestamp: e.timestamp ? new Date(e.timestamp).toISOString() : '',
        message: e.message ?? '',
        logStream: e.logStreamName ?? '',
      }));
    } catch (err) {
      this.noteAuthorizationFailure(err, `fetch logs from ${logGroupName}`);
      return [];
    }
  }

  // ── Alert events (webhook inbox) ─────────────────────────────────────────

  async getRecentAlerts(limit = 50): Promise<AlertEvent[]> {
    return this.alertEventModel.findAll({
      order: [['createdAt', 'DESC']],
      limit,
    });
  }

  async recordAlert(payload: Record<string, unknown>): Promise<AlertEvent> {
    const alarmName = String(payload['AlarmName'] ?? payload['alarmName'] ?? 'Unknown Alarm');
    const state = String(payload['NewStateValue'] ?? payload['state'] ?? 'ALARM');
    const description = payload['AlarmDescription'] ?? payload['description'];
    const metric = String(payload['Trigger']?.['MetricName'] ?? payload['metric'] ?? '');
    const source = 'cloudwatch';
    const triggeredAt = new Date(
      String(payload['StateChangeTime'] ?? payload['triggeredAt'] ?? new Date().toISOString()),
    );

    return this.alertEventModel.create({
      alarmName,
      state,
      description: description ? String(description) : undefined,
      metric,
      source,
      triggeredAt,
      rawPayload: payload,
    } as any);
  }
}
