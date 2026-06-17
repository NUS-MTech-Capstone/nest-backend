import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Session } from './session.entity';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { ChangeRequest } from '../change-request/change-request.entity';
import { ImplementerGroup } from '../implementer-group/implementer-group.entity';
import { ImplementerGroupMember } from '../implementer-group/implementer-group-member.entity';
import { VirtualMachine } from '../inventory/vm.entity';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Session,
      ChangeRequest,
      ImplementerGroup,
      ImplementerGroupMember,
      VirtualMachine,
    ]),
  ],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
