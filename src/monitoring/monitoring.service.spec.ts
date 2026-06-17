import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/sequelize';
import { MonitoringService } from './monitoring.service';
import { AlertEvent } from './alert-event.entity';

jest.mock('@aws-sdk/client-cloudwatch');
jest.mock('@aws-sdk/client-cloudwatch-logs');

import { CloudWatchClient, DescribeAlarmsCommand } from '@aws-sdk/client-cloudwatch';
import { CloudWatchLogsClient, FilterLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';

describe('MonitoringService', () => {
  let service: MonitoringService;
  let mockSendCw: jest.Mock;
  let mockSendLogs: jest.Mock;
  let alertEventModel: {
    findAll: jest.Mock;
    create: jest.Mock;
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    delete process.env.CLOUDWATCH_REGION;
    delete process.env.AWS_REGION;
    delete process.env.CLOUDWATCH_LOG_GROUP;
    delete process.env.CLOUDWATCH_SESSION_LOG_GROUP;

    mockSendCw = jest.fn();
    mockSendLogs = jest.fn();
    (CloudWatchClient as jest.Mock).mockImplementation(() => ({ send: mockSendCw }));
    (CloudWatchLogsClient as jest.Mock).mockImplementation(() => ({ send: mockSendLogs }));
    (DescribeAlarmsCommand as unknown as jest.Mock).mockImplementation((input: unknown) => ({
      input,
    }));
    (FilterLogEventsCommand as unknown as jest.Mock).mockImplementation((input: unknown) => ({
      input,
    }));

    alertEventModel = {
      findAll: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 'alert-1', alarmName: 'HighCPU' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MonitoringService,
        { provide: getModelToken(AlertEvent), useValue: alertEventModel },
      ],
    }).compile();

    service = module.get(MonitoringService);
  });

  describe('getStatus', () => {
    it('returns configured=false when no region is set', () => {
      expect(service.getStatus()).toEqual({ configured: false });
    });

    it('returns configured=true with region and log groups when env is set', async () => {
      process.env.CLOUDWATCH_REGION = 'ap-southeast-1';
      process.env.CLOUDWATCH_LOG_GROUP = '/ecs/api';
      process.env.CLOUDWATCH_SESSION_LOG_GROUP = '/ecs/sessions';

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          MonitoringService,
          { provide: getModelToken(AlertEvent), useValue: alertEventModel },
        ],
      }).compile();
      const configuredService = module.get(MonitoringService);

      expect(configuredService.getStatus()).toEqual({
        configured: true,
        region: 'ap-southeast-1',
        logGroup: '/ecs/api',
        sessionLogGroup: '/ecs/sessions',
      });
    });
  });

  describe('getAlarms', () => {
    it('returns empty array when CloudWatch is not configured', async () => {
      await expect(service.getAlarms()).resolves.toEqual([]);
      expect(mockSendCw).not.toHaveBeenCalled();
    });

    it('maps CloudWatch alarm results when configured', async () => {
      process.env.CLOUDWATCH_REGION = 'ap-southeast-1';
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          MonitoringService,
          { provide: getModelToken(AlertEvent), useValue: alertEventModel },
        ],
      }).compile();
      const configuredService = module.get(MonitoringService);

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
    });

    it('returns empty array when CloudWatch send fails', async () => {
      process.env.CLOUDWATCH_REGION = 'ap-southeast-1';
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          MonitoringService,
          { provide: getModelToken(AlertEvent), useValue: alertEventModel },
        ],
      }).compile();
      const configuredService = module.get(MonitoringService);

      mockSendCw.mockRejectedValue(new Error('AccessDenied'));
      await expect(configuredService.getAlarms()).resolves.toEqual([]);
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
  });

  describe('getApplicationLogs / getSessionLogs', () => {
    it('returns empty array when log group is not configured', async () => {
      await expect(service.getApplicationLogs()).resolves.toEqual([]);
      await expect(service.getSessionLogs()).resolves.toEqual([]);
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
    });
  });
});
