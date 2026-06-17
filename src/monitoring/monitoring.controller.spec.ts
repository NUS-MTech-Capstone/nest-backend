import { Test, TestingModule } from '@nestjs/testing';
import { MonitoringController } from './monitoring.controller';
import { MonitoringService } from './monitoring.service';

describe('MonitoringController', () => {
  let controller: MonitoringController;
  let service: {
    getStatus: jest.Mock;
    getAlarms: jest.Mock;
    getMetrics: jest.Mock;
    getApplicationLogs: jest.Mock;
    getSessionLogs: jest.Mock;
    getRecentAlerts: jest.Mock;
    recordAlert: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      getStatus: jest.fn().mockReturnValue({ configured: false }),
      getAlarms: jest.fn().mockResolvedValue([]),
      getMetrics: jest.fn().mockResolvedValue({ name: 'RequestCount', dataPoints: [] }),
      getApplicationLogs: jest.fn().mockResolvedValue([]),
      getSessionLogs: jest.fn().mockResolvedValue([]),
      getRecentAlerts: jest.fn().mockResolvedValue([]),
      recordAlert: jest.fn().mockResolvedValue({ id: 'alert-1', alarmName: 'HighCPU', state: 'ALARM' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MonitoringController],
      providers: [{ provide: MonitoringService, useValue: service }],
    }).compile();

    controller = module.get(MonitoringController);
  });

  it('getStatus delegates to service', () => {
    const status = { configured: true, region: 'ap-southeast-1' };
    service.getStatus.mockReturnValue(status);
    expect(controller.getStatus()).toBe(status);
  });

  it('getAlarms delegates to service', async () => {
    const alarms = [{ name: 'HighCPU', state: 'ALARM' }];
    service.getAlarms.mockResolvedValue(alarms);
    await expect(controller.getAlarms()).resolves.toBe(alarms);
  });

  it('getMetrics passes query params to service with default namespace', async () => {
    process.env.CLOUDWATCH_NAMESPACE = 'DenDenMushi';
    await controller.getMetrics('ErrorCount', undefined, '6', '300');
    expect(service.getMetrics).toHaveBeenCalledWith('ErrorCount', 'DenDenMushi', 6, 300);
  });

  it('getAppLogs passes limit and filter to service', async () => {
    await controller.getAppLogs('50', 'ERROR');
    expect(service.getApplicationLogs).toHaveBeenCalledWith(50, 'ERROR');
  });

  it('getSessionLogs passes limit and filter to service', async () => {
    await controller.getSessionLogs('25', 'user123');
    expect(service.getSessionLogs).toHaveBeenCalledWith(25, 'user123');
  });

  it('getAlerts passes limit to service', async () => {
    await controller.getAlerts('10');
    expect(service.getRecentAlerts).toHaveBeenCalledWith(10);
  });

  describe('receiveAlert', () => {
    it('acknowledges SNS subscription confirmation and calls SubscribeURL', async () => {
      const fetchMock = jest.fn().mockResolvedValue({});
      global.fetch = fetchMock;

      const result = await controller.receiveAlert('SubscriptionConfirmation', {
        SubscribeURL: 'https://sns.aws/confirm',
      });

      expect(fetchMock).toHaveBeenCalledWith('https://sns.aws/confirm');
      expect(result).toEqual({ message: 'SubscriptionConfirmation acknowledged' });
    });

    it('records alert from SNS notification with JSON message body', async () => {
      const alarmPayload = { AlarmName: 'HighCPU', NewStateValue: 'ALARM' };
      const result = await controller.receiveAlert('Notification', {
        Message: JSON.stringify(alarmPayload),
      });

      expect(service.recordAlert).toHaveBeenCalledWith(alarmPayload);
      expect(result).toEqual({ message: 'Alert recorded', id: 'alert-1' });
    });

    it('ignores unknown SNS message types', async () => {
      const result = await controller.receiveAlert('UnsubscribeConfirmation', {});
      expect(result).toEqual({ message: 'Ignored' });
      expect(service.recordAlert).not.toHaveBeenCalled();
    });
  });
});
