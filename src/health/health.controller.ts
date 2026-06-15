import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Public } from '../auth/decorators';

@Controller()
export class HealthController {
  constructor(@InjectConnection() private sequelize: Sequelize) {}

  @Public()
  @Get('healthz')
  health() {
    return { status: 'ok', service: 'ddm' };
  }

  @Public()
  @Get('readyz')
  async ready() {
    try {
      await this.sequelize.query('SELECT 1');
      return { status: 'ready', service: 'ddm' };
    } catch {
      throw new ServiceUnavailableException({
        status: 'not-ready',
        service: 'ddm',
      });
    }
  }
}
