import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Public } from '../auth/decorators';

@Controller()
export class HealthController {
  constructor(@InjectConnection() private sequelize: Sequelize) {}

  @Public()
  @Get('health')
  health() {
    return { status: 'ok', service: 'ddm' };
  }

  @Public()
  @Get('ready')
  async ready() {
    await this.sequelize.authenticate();
    return { status: 'ready', service: 'ddm' };
  }
}
