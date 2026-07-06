import { Controller, Get, Param, Query } from '@nestjs/common';
import { RequirePermission } from '../auth/decorators';
import { SessionAuditService } from './session-audit.service';
import type {
  ListAuditRecordsQuery,
  ListAuditSessionsQuery,
  ListSessionAuditRecordsQuery,
} from './session-audit.types';

@Controller('session-audit')
@RequirePermission('session-audit.view')
export class SessionAuditController {
  constructor(private readonly sessionAuditService: SessionAuditService) {}

  @Get('sessions')
  listSessions(@Query() query: ListAuditSessionsQuery) {
    return this.sessionAuditService.listSessions(query);
  }

  @Get('records')
  listRecordsGlobal(@Query() query: ListAuditRecordsQuery) {
    return this.sessionAuditService.listRecordsGlobal(query);
  }

  @Get('sessions/:sessionId/records')
  listRecords(
    @Param('sessionId') sessionId: string,
    @Query() query: ListSessionAuditRecordsQuery,
  ) {
    return this.sessionAuditService.listRecords(sessionId, query);
  }
}
