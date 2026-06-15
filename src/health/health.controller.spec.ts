import { Test, TestingModule } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/sequelize';
import { HealthController } from './health.controller';
import { SERVICE_NAME } from '../common/service.constants';

describe('HealthController', () => {
  let controller: HealthController;
  let query: jest.Mock;

  beforeEach(async () => {
    query = jest.fn().mockResolvedValue([[], {}]);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: getConnectionToken(),
          useValue: { query },
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
      expect(query).toHaveBeenCalledWith('SELECT 1');
    });

    it('returns service unavailable when the query fails', async () => {
      query.mockRejectedValue(new Error('connection failed'));

      await expect(controller.ready()).rejects.toThrow(
        'Service Unavailable Exception',
      );
    });
  });
});
