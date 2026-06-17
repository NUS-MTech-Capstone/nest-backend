import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { SequelizeModule } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
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
export class AppModule implements OnModuleInit {
  private logger = new Logger('AppModule');

  constructor(private moduleRef: ModuleRef) {}

  async onModuleInit() {
    try {
      const sequelize = this.moduleRef.get(Sequelize, { strict: false });
      const isProd = process.env.NODE_ENV === 'production';

      if (isProd) {
        const existing = await sequelize.getQueryInterface().showAllTables();
        if (existing.length === 0) {
          this.logger.log('Empty database — creating all tables...');
          await sequelize.sync();
          this.logger.log('All tables created successfully');
        } else {
          this.logger.log(
            `Database already has ${existing.length} table(s) — skipping sync`,
          );
        }
      } else {
        this.logger.log('Synchronizing database schema (alter=true)...');
        await sequelize.sync({ alter: true });
        this.logger.log('Database schema synchronized successfully');
      }
    } catch (error) {
      this.logger.error('Failed to synchronize database schema', error);
    }
  }
}
