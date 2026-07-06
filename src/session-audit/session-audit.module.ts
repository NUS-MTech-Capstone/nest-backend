import { Module } from '@nestjs/common';
import { AuditEventsController } from './audit-events.controller';
import { SessionAuditController } from './session-audit.controller';
import { SessionAuditService } from './session-audit.service';

@Module({
  controllers: [SessionAuditController, AuditEventsController],
  providers: [SessionAuditService],
})
export class SessionAuditModule {}
