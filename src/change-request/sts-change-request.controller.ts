import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Public } from '../auth/decorators';
import { VirtualMachine } from '../inventory/vm.entity';
import { ChangeRequestStatus } from './change-request.entity';
import { ChangeRequestService } from './change-request.service';

export interface StsChangeRequestResponse {
  crId: string;
  status: ChangeRequestStatus;
  hostIds: string[];
}

@Controller('sts/change-requests')
export class StsChangeRequestController {
  constructor(
    private readonly changeRequestService: ChangeRequestService,
    @InjectModel(VirtualMachine)
    private readonly virtualMachineModel: typeof VirtualMachine,
  ) {}

  @Get(':id')
  @Public()
  async findOne(@Param('id') id: string): Promise<StsChangeRequestResponse> {
    const request = await this.changeRequestService.findOne(id);
    if (!request) {
      throw new NotFoundException(`Change request ${id} not found`);
    }

    const vms = request.vmIds.length
      ? await this.virtualMachineModel.findAll({ where: { id: request.vmIds } })
      : [];

    return {
      crId: request.id,
      status: request.status,
      hostIds: vms.map((vm) => vm.hostname),
    };
  }
}
