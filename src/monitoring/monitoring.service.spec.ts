import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/sequelize';
import { MonitoringService } from './monitoring.service';
import { AlertEvent } from './alert-event.entity';
import {
  MonitoringCacheService,
  monitoringMetricCacheKey,
} from './monitoring-cache.service';

jest.mock('@aws-sdk/client-cloudwatch');
jest.mock('@aws-sdk/client-cloudwatch-logs');

import {
  CloudWatchClient,
  DescribeAlarmsCommand,
  GetMetricStatisticsCommand,
} from '@aws-sdk/client-cloudwatch';
import {
  CloudWatchLogsClient,
  FilterLogEventsCommand,
} from '@aws-sdk/client-cloudwatch-logs';

describe('MonitoringService', () => {
  let service: MonitoringService;
  let mockSendCw: jest.Mock;
  let mockSendLogs: jest.Mock;
  let alertEventModel: {
    findAll: jest.Mock;
    create: jest.Mock;
  };
  let monitoringCache: {
    getStatus: jest.Mock;
    getJSON: jest.Mock;
    setJSON: jest.Mock;
  };

  async function buildService(): Promise<MonitoringService> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MonitoringService,
        { provide: getModelToken(AlertEvent), useValue: alertEventModel },
        { provide: MonitoringCacheService, useValue: monitoringCache },
      ],
    }).compile();
    return module.get(MonitoringService);
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    delete process.env.CLOUDWATCH_REGION;
    delete process.env.AWS_REGION;
    delete process.env.CLOUDWATCH_LOG_GROUP;
    delete process.env.CLOUDWATCH_SESSION_LOG_GROUP;

    mockSendCw = jest.fn();
    mockSendLogs = jest.fn();
    (CloudWatchClient as jest.Mock).mockImplementation(() => ({
      send: mockSendCw,
    }));
    (CloudWatchLogsClient as jest.Mock).mockImplementation(() => ({
      send: mockSendLogs,
    }));
    (DescribeAlarmsCommand as unknown as jest.Mock).mockImplementation(
      (input: unknown) => ({
        input,
      }),
    );
    (FilterLogEventsCommand as unknown as jest.Mock).mockImplementation(
      (input: unknown) => ({
        input,
      }),
    );
    (GetMetricStatisticsCommand as unknown as jest.Mock).mockImplementation(
      (input: unknown) => ({ input }),
    );

    alertEventModel = {
      findAll: jest.fn().mockResolvedValue([]),
      create: jest
        .fn()
        .mockResolvedValue({ id: 'alert-1', alarmName: 'HighCPU' }),
    };
    monitoringCache = {
      getStatus: jest.fn().mockReturnValue({
        provider: 'redis',
        enabled: false,
        available: false,
        ttlSeconds: 60,
      }),
      getJSON: jest.fn().mockResolvedValue(undefined),
      setJSON: jest.fn().mockResolvedValue(true),
    };

    service = await buildService();
  });

  describe('getStatus', () => {
    it('returns configured=false when no region is set', () => {
      expect(service.getStatus()).toEqual({
        configured: false,
        cache: {
          provider: 'redis',
          enabled: false,
          available: false,
          ttlSeconds: 60,
        },
      });
    });

    it('returns configured=true with region and log groups when env is set', async () => {
      process.env.CLOUDWATCH_REGION = 'ap-southeast-1';
      process.env.CLOUDWATCH_LOG_GROUP = '/ecs/api';
      process.env.CLOUDWATCH_SESSION_LOG_GROUP = '/ecs/sessions';

      const configuredService = await buildService();

      expect(configuredService.getStatus()).toEqual({
        configured: true,
        region: 'ap-southeast-1',
        logGroup: '/ecs/api',
        sessionLogGroup: '/ecs/sessions',
        awsAuthorized: true,
        cache: {
          provider: 'redis',
          enabled: false,
          available: false,
          ttlSeconds: 60,
        },
      });
    });

    it('marks awsAuthorized=false after CloudWatch returns AccessDenied', async () => {
      process.env.CLOUDWATCH_REGION = 'ap-southeast-1';
      mockSendCw.mockRejectedValue(
        Object.assign(new Error('not authorized'), { name: 'AccessDenied' }),
      );

      const configuredService = await buildService();

      await configuredService.getAlarms();

      expect(configuredService.getStatus()).toEqual(
        expect.objectContaining({
          configured: true,
          awsAuthorized: false,
          authorizationHint: expect.stringContaining(
            'CloudWatch read permissions',
          ),
        }),
      );
    });
  });

  describe('getAlarms', () => {
    it('returns empty array when CloudWatch is not configured', async () => {
      await expect(service.getAlarms()).resolves.toEqual([]);
      expect(mockSendCw).not.toHaveBeenCalled();
    });

    it('maps CloudWatch alarm results when configured', async () => {
      process.env.CLOUDWATCH_REGION = 'ap-southeast-1';
      const configuredService = await buildService();

      const updatedAt = new Date('2026-06-18T00:00:00.000Z');
      mockSendCw.mockResolvedValue({
        MetricAlarms: [
          {
            AlarmName: 'HighCPU',
            StateValue: 'ALARM',
            AlarmDescription: 'CPU above 80%',
            MetricName: 'CPUUtilization',
            Namespace: 'AWS/EC2',
            Threshold: 80,
            StateUpdatedTimestamp: updatedAt,
          },
        ],
      });

      const alarms = await configuredService.getAlarms();
      expect(alarms).toEqual([
        {
          name: 'HighCPU',
          state: 'ALARM',
          description: 'CPU above 80%',
          metric: 'CPUUtilization',
          namespace: 'AWS/EC2',
          threshold: 80,
          updatedAt: updatedAt.toISOString(),
        },
      ]);
      expect(monitoringCache.setJSON).toHaveBeenCalledWith(
        'ddm:nest-backend:monitoring:v1:alarms',
        alarms,
      );
    });

    it('returns a cached alarm response without calling CloudWatch', async () => {
      process.env.CLOUDWATCH_REGION = 'ap-southeast-1';
      const cached = [
        {
          name: 'CachedAlarm',
          state: 'OK',
          metric: 'CPUUtilization',
          namespace: 'AWS/EC2',
          updatedAt: '2026-06-18T00:00:00.000Z',
        },
      ];
      monitoringCache.getJSON.mockResolvedValue(cached);
      const configuredService = await buildService();

      await expect(configuredService.getAlarms()).resolves.toBe(cached);
      expect(mockSendCw).not.toHaveBeenCalled();
      expect(monitoringCache.setJSON).not.toHaveBeenCalled();
    });

    it('caches a successful empty alarm response', async () => {
      process.env.CLOUDWATCH_REGION = 'ap-southeast-1';
      mockSendCw.mockResolvedValue({ MetricAlarms: [] });
      const configuredService = await buildService();

      await expect(configuredService.getAlarms()).resolves.toEqual([]);
      expect(monitoringCache.setJSON).toHaveBeenCalledWith(
        'ddm:nest-backend:monitoring:v1:alarms',
        [],
      );
    });

    it('returns empty array when CloudWatch send fails', async () => {
      process.env.CLOUDWATCH_REGION = 'ap-southeast-1';
      const configuredService = await buildService();

      mockSendCw.mockRejectedValue(new Error('AccessDenied'));
      await expect(configuredService.getAlarms()).resolves.toEqual([]);
      expect(monitoringCache.setJSON).not.toHaveBeenCalled();
    });
  });

  describe('getMetrics', () => {
    it('returns empty data points when CloudWatch is not configured', async () => {
      const result = await service.getMetrics('RequestCount', 'DenDenMushi');
      expect(result).toEqual({
        name: 'RequestCount',
        namespace: 'DenDenMushi',
        unit: 'Count',
        dataPoints: [],
      });
    });

    it('maps sorted metric datapoints and current value when configured', async () => {
      process.env.CLOUDWATCH_REGION = 'ap-southeast-1';
      const configuredService = await buildService();

      mockSendCw.mockResolvedValue({
        Datapoints: [
          {
            Timestamp: new Date('2026-06-18T01:00:00.000Z'),
            Sum: 5,
            Unit: 'Count',
          },
          {
            Timestamp: new Date('2026-06-18T02:00:00.000Z'),
            Sum: 12,
            Unit: 'Count',
          },
        ],
      });

      const expected = {
        name: 'RequestCount',
        namespace: 'DenDenMushi',
        unit: 'Count',
        current: 12,
        dataPoints: [
          {
            timestamp: '2026-06-18T01:00:00.000Z',
            value: 5,
          },
          {
            timestamp: '2026-06-18T02:00:00.000Z',
            value: 12,
          },
        ],
      };
      await expect(
        configuredService.getMetrics('RequestCount', 'DenDenMushi', 24),
      ).resolves.toEqual(expected);
      expect(monitoringCache.setJSON).toHaveBeenCalledWith(
        monitoringMetricCacheKey('RequestCount', 'DenDenMushi', 24, 3600),
        expected,
      );
    });

    it('uses parameter-specific metric cache keys and bypasses CloudWatch on a hit', async () => {
      process.env.CLOUDWATCH_REGION = 'ap-southeast-1';
      const cached = {
        name: 'CPUUtilization',
        namespace: 'AWS/EC2',
        unit: 'Percent',
        dataPoints: [],
      };
      monitoringCache.getJSON.mockResolvedValue(cached);
      const configuredService = await buildService();

      await expect(
        configuredService.getMetrics('CPUUtilization', 'AWS/EC2', 6, 300),
      ).resolves.toBe(cached);
      expect(monitoringCache.getJSON).toHaveBeenCalledWith(
        monitoringMetricCacheKey('CPUUtilization', 'AWS/EC2', 6, 300),
      );
      expect(mockSendCw).not.toHaveBeenCalled();
    });
  });

  describe('getApplicationLogs / getSessionLogs', () => {
    it('returns empty array when log group is not configured', async () => {
      await expect(service.getApplicationLogs()).resolves.toEqual([]);
      await expect(service.getSessionLogs()).resolves.toEqual([]);
    });

    it('maps CloudWatch log events when application log group is configured', async () => {
      process.env.CLOUDWATCH_REGION = 'ap-southeast-1';
      process.env.CLOUDWATCH_LOG_GROUP = '/ecs/api';
      const configuredService = await buildService();

      mockSendLogs.mockResolvedValue({
        events: [
          {
            timestamp: 1_718_678_400_000,
            message: 'ERROR something failed',
            logStreamName: 'api/stream-1',
          },
        ],
      });

      await expect(
        configuredService.getApplicationLogs(50, 'ERROR'),
      ).resolves.toEqual([
        {
          timestamp: new Date(1_718_678_400_000).toISOString(),
          message: 'ERROR something failed',
          logStream: 'api/stream-1',
        },
      ]);
      expect(monitoringCache.getJSON).not.toHaveBeenCalled();
      expect(monitoringCache.setJSON).not.toHaveBeenCalled();
    });

    it('defaults session log filter pattern to "session"', async () => {
      process.env.CLOUDWATCH_REGION = 'ap-southeast-1';
      process.env.CLOUDWATCH_SESSION_LOG_GROUP = '/ecs/sessions';
      const configuredService = await buildService();

      mockSendLogs.mockResolvedValue({ events: [] });

      await configuredService.getSessionLogs(25);

      expect(FilterLogEventsCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          logGroupName: '/ecs/sessions',
          limit: 25,
          filterPattern: 'session',
        }),
      );
    });
  });

  describe('getRecentAlerts', () => {
    it('returns alerts ordered by createdAt DESC', async () => {
      const alerts = [{ id: 'a1' }];
      alertEventModel.findAll.mockResolvedValue(alerts);

      await expect(service.getRecentAlerts(25)).resolves.toBe(alerts);
      expect(alertEventModel.findAll).toHaveBeenCalledWith({
        order: [['createdAt', 'DESC']],
        limit: 25,
      });
    });
  });

  describe('recordAlert', () => {
    it('creates an alert event from CloudWatch SNS payload', async () => {
      const payload = {
        AlarmName: 'HighErrorRate',
        NewStateValue: 'ALARM',
        AlarmDescription: 'Too many errors',
        StateChangeTime: '2026-06-18T01:00:00.000Z',
        Trigger: { MetricName: 'ErrorCount' },
      };

      await service.recordAlert(payload);

      expect(alertEventModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          alarmName: 'HighErrorRate',
          state: 'ALARM',
          description: 'Too many errors',
          metric: 'ErrorCount',
          source: 'cloudwatch',
        }),
      );
      expect(monitoringCache.getJSON).not.toHaveBeenCalled();
      expect(monitoringCache.setJSON).not.toHaveBeenCalled();
    });
  });
});
