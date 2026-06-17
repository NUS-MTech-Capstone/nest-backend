import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Logger,
  Post,
  Query,
} from '@nestjs/common';
import { RequirePermission, Public } from '../auth/decorators';
import { MonitoringService } from './monitoring.service';

@Controller('monitoring')
export class MonitoringController {
  private readonly logger = new Logger(MonitoringController.name);

  constructor(private readonly monitoringService: MonitoringService) {}

  @Get('status')
  @RequirePermission('monitoring.view')
  getStatus() {
    return this.monitoringService.getStatus();
  }

  @Get('alarms')
  @RequirePermission('monitoring.view')
  getAlarms() {
    return this.monitoringService.getAlarms();
  }

  @Get('metrics')
  @RequirePermission('monitoring.view')
  getMetrics(
    @Query('metric') metric = 'RequestCount',
    @Query('namespace') namespace?: string,
    @Query('hours') hours = '24',
    @Query('period') period = '3600',
  ) {
    const ns = namespace ?? process.env.CLOUDWATCH_NAMESPACE ?? 'DenDenMushi';
    return this.monitoringService.getMetrics(metric, ns, Number(hours), Number(period));
  }

  @Get('logs/app')
  @RequirePermission('monitoring.view')
  getAppLogs(
    @Query('limit') limit = '100',
    @Query('filter') filter?: string,
  ) {
    return this.monitoringService.getApplicationLogs(Number(limit), filter);
  }

  @Get('logs/sessions')
  @RequirePermission('monitoring.sessions')
  getSessionLogs(
    @Query('limit') limit = '100',
    @Query('filter') filter?: string,
  ) {
    return this.monitoringService.getSessionLogs(Number(limit), filter);
  }

  @Get('alerts')
  @RequirePermission('monitoring.view')
  getAlerts(@Query('limit') limit = '50') {
    return this.monitoringService.getRecentAlerts(Number(limit));
  }

  /**
   * SNS webhook receiver — CloudWatch Alarm → SNS topic → this endpoint.
   * This endpoint is intentionally public so AWS SNS can POST to it without auth.
   * Validate the SNS message type header and handle SubscriptionConfirmation.
   */
  @Post('alerts/webhook')
  @Public()
  @HttpCode(200)
  async receiveAlert(
    @Headers('x-amz-sns-message-type') snsType: string,
    @Body() body: Record<string, unknown>,
  ) {
    if (snsType === 'SubscriptionConfirmation') {
      const subscribeUrl = body['SubscribeURL'] as string | undefined;
      if (subscribeUrl) {
        this.logger.log(`Confirming SNS subscription: ${subscribeUrl}`);
        try {
          await fetch(subscribeUrl);
        } catch (e) {
          this.logger.error(`SNS subscription confirmation failed: ${e}`);
        }
      }
      return { message: 'SubscriptionConfirmation acknowledged' };
    }

    if (snsType === 'Notification') {
      let payload = body;
      try {
        payload = JSON.parse(body['Message'] as string) as Record<string, unknown>;
      } catch {
        // Message is not JSON — store raw body
      }

      const alert = await this.monitoringService.recordAlert(payload);
      this.logger.log(`Alert received: ${alert.alarmName} → ${alert.state}`);
      return { message: 'Alert recorded', id: alert.id };
    }

    return { message: 'Ignored' };
  }
}
