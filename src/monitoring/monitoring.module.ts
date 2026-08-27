import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AlertEvent } from './alert-event.entity';
import { MonitoringController } from './monitoring.controller';
import { MonitoringCacheService } from './monitoring-cache.service';
import { MonitoringService } from './monitoring.service';

@Module({
  imports: [SequelizeModule.forFeature([AlertEvent])],
  controllers: [MonitoringController],
  providers: [MonitoringCacheService, MonitoringService],
  exports: [MonitoringService],
})
export class MonitoringModule {}
