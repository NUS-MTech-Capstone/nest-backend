import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { VirtualMachine } from '../inventory/vm.entity';
import { ImplementerGroupController } from './implementer-group.controller';
import { ImplementerGroupService } from './implementer-group.service';
import { ImplementerGroup } from './implementer-group.entity';
import { ImplementerGroupMember } from './implementer-group-member.entity';
import { ImplementerGroupMembershipRequest } from './implementer-group-membership-request.entity';
import { ImplementerGroupMembershipRepository } from './implementer-group-membership.repository';
import { ImplementerGroupMembershipService } from './implementer-group-membership.service';

@Module({
  imports: [
    SequelizeModule.forFeature([
      ImplementerGroup,
      ImplementerGroupMember,
      ImplementerGroupMembershipRequest,
      VirtualMachine,
    ]),
  ],
  controllers: [ImplementerGroupController],
  providers: [
    ImplementerGroupService,
    ImplementerGroupMembershipRepository,
    ImplementerGroupMembershipService,
  ],
  exports: [ImplementerGroupService, ImplementerGroupMembershipService],
})
export class ImplementerGroupModule {}
