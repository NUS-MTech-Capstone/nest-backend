import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/sequelize';
import { HealthController } from './health.controller';
import { SERVICE_NAME } from '../common/service.constants';

describe('HealthController', () => {
  let controller: HealthController;
  let query: jest.Mock;

  beforeEach(async () => {
    query = jest.fn().mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: getConnectionToken(),
          useValue: { query },
        },
      ],
    }).compile();

    controller = module.get(HealthController);
  });

  describe('healthz', () => {
    it('returns ok status and service name', () => {
      expect(controller.healthz()).toEqual({
        status: 'ok',
        service: SERVICE_NAME,
      });
    });
  });

  describe('readyz', () => {
    it('executes SELECT 1 and returns ready status', async () => {
      await expect(controller.readyz()).resolves.toEqual({
        status: 'ready',
        service: SERVICE_NAME,
      });
      expect(query).toHaveBeenCalledWith('SELECT 1');
    });

    it('returns 503 when PostgreSQL is unavailable', async () => {
      query.mockRejectedValue(new Error('connection failed'));

      await expect(controller.readyz()).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });
  });
});
