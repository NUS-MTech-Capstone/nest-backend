import { Controller, Get, Query } from '@nestjs/common';
import { RequirePermission } from '../auth/decorators';
import { SessionAuditService } from './session-audit.service';
import type { ListMetadataEventsQuery } from './session-audit.types';

@Controller('audit/events')
@RequirePermission('session-audit.view')
export class AuditEventsController {
  constructor(private readonly sessionAuditService: SessionAuditService) {}

  @Get()
  listEvents(@Query() query: ListMetadataEventsQuery) {
    return this.sessionAuditService.listMetadataEvents(query);
  }
}
