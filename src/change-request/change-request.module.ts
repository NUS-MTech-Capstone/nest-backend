import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ChangeRequestController } from './change-request.controller';
import { ChangeRequestService } from './change-request.service';
import { ChangeRequest } from './change-request.entity';
import { StsChangeRequestController } from './sts-change-request.controller';
import { VirtualMachine } from '../inventory/vm.entity';
import { ImplementerGroupModule } from '../implementer-group/implementer-group.module';

@Module({
  imports: [
    SequelizeModule.forFeature([ChangeRequest, VirtualMachine]),
    ImplementerGroupModule,
  ],
  controllers: [ChangeRequestController, StsChangeRequestController],
  providers: [ChangeRequestService],
})
export class ChangeRequestModule {}
