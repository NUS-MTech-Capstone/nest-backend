import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ChangeRequestModule } from './change-request/change-request.module';
import { ChangeRequest } from './change-request/change-request.entity';
import { InventoryModule } from './inventory/inventory.module';
import { VirtualMachine } from './inventory/vm.entity';
import { InventoryChangeRequest } from './inventory/inventory-change-request.entity';
import { AuthModule } from './auth/auth.module';
import { IdentityModule } from './identity/identity.module';
import { AccessPolicy } from './identity/access-policy.entity';
import { ImplementerGroup } from './implementer-group/implementer-group.entity';
import { ImplementerGroupMember } from './implementer-group/implementer-group-member.entity';
import { ImplementerGroupMembershipRequest } from './implementer-group/implementer-group-membership-request.entity';
import { ImplementerGroupModule } from './implementer-group/implementer-group.module';
import { HealthModule } from './health/health.module';
import { SessionsModule } from './sessions/sessions.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { AlertEvent } from './monitoring/alert-event.entity';
import { Session } from './sessions/session.entity';
import { buildDatabaseConfig } from './config/database.config';

const models = [
  ChangeRequest,
  VirtualMachine,
  InventoryChangeRequest,
  AccessPolicy,
  ImplementerGroup,
  ImplementerGroupMember,
  ImplementerGroupMembershipRequest,
  AlertEvent,
  Session,
];

@Module({
  imports: [
    SequelizeModule.forRoot(buildDatabaseConfig(models)),
    HealthModule,
    AuthModule,
    IdentityModule,
    ChangeRequestModule,
    InventoryModule,
    ImplementerGroupModule,
    SessionsModule,
    MonitoringModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
