import {
  Controller,
  Get,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Public } from '../auth/decorators';
import { SERVICE_NAME } from '../common/service.constants';

@Controller()
export class HealthController {
  constructor(@InjectConnection() private sequelize: Sequelize) {}

  @Public()
  @Get('healthz')
  healthz() {
    return { status: 'ok', service: SERVICE_NAME };
  }

  @Public()
  @Get('readyz')
  async readyz() {
    try {
      await this.sequelize.query('SELECT 1');
      return { status: 'ready', service: SERVICE_NAME };
    } catch {
      throw new ServiceUnavailableException({
        status: 'unavailable',
        service: SERVICE_NAME,
      });
    }
  }
}
