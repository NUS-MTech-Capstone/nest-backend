import { Test, TestingModule } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/sequelize';
import { HealthController } from './health.controller';
import { SERVICE_NAME } from '../common/service.constants';

describe('HealthController', () => {
  let controller: HealthController;
  let authenticate: jest.Mock;

  beforeEach(async () => {
    authenticate = jest.fn().mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: getConnectionToken(),
          useValue: { authenticate },
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  describe('health', () => {
    it('returns ok status and service name', () => {
      expect(controller.health()).toEqual({
        status: 'ok',
        service: SERVICE_NAME,
      });
    });
  });

  describe('ready', () => {
    it('authenticates sequelize and returns ready status', async () => {
      await expect(controller.ready()).resolves.toEqual({
        status: 'ready',
        service: SERVICE_NAME,
      });
      expect(authenticate).toHaveBeenCalledTimes(1);
    });

    it('propagates sequelize authentication errors', async () => {
      authenticate.mockRejectedValue(new Error('connection failed'));

      await expect(controller.ready()).rejects.toThrow('connection failed');
    });
  });
});
