import { Module } from '@nestjs/common';
import { SessionAuditController } from './session-audit.controller';
import { SessionAuditService } from './session-audit.service';

@Module({
  controllers: [SessionAuditController],
  providers: [SessionAuditService],
})
export class SessionAuditModule {}
