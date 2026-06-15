import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { CreateVmDto } from './dto/create-vm.dto';
import { UpdateVmDto } from './dto/update-vm.dto';
import { AssetStatus, VirtualMachine } from './vm.entity';

@Injectable()
export class InventoryService {
  constructor(
    @InjectModel(VirtualMachine)
    private virtualMachineModel: typeof VirtualMachine,
  ) {}

  findAll(): Promise<VirtualMachine[]> {
    return this.virtualMachineModel.findAll({
      order: [['hostname', 'ASC']],
    });
  }

  findOne(id: string): Promise<VirtualMachine | null> {
    return this.virtualMachineModel.findByPk(id, { plain: true });
  }

  findByHostname(hostname: string): Promise<VirtualMachine | null> {
    return this.virtualMachineModel.findOne({
      where: { hostname },
      plain: true,
    });
  }

  create(createVmDto: CreateVmDto): Promise<VirtualMachine> {
    return this.virtualMachineModel.create({
      hostname: createVmDto.hostname,
      ipAddress: createVmDto.ipAddress,
      assetStatus: createVmDto.assetStatus ?? AssetStatus.Active,
      osVersion: createVmDto.osVersion,
      sshPort: createVmDto.sshPort ?? 22,
    });
  }

  async update(
    id: string,
    updateVmDto: UpdateVmDto,
  ): Promise<VirtualMachine | undefined> {
    const vm = await this.findOne(id);
    if (!vm) {
      return undefined;
    }

    if (updateVmDto.hostname !== undefined) {
      vm.hostname = updateVmDto.hostname;
    }
    if (updateVmDto.ipAddress !== undefined) {
      vm.ipAddress = updateVmDto.ipAddress;
    }
    if (updateVmDto.assetStatus !== undefined) {
      vm.assetStatus = updateVmDto.assetStatus;
    }
    if (updateVmDto.osVersion !== undefined) {
      vm.osVersion = updateVmDto.osVersion;
    }
    if (updateVmDto.sshPort !== undefined) {
      vm.sshPort = updateVmDto.sshPort;
    }

    return vm.save();
  }

  async remove(id: string): Promise<boolean> {
    const deleted = await this.virtualMachineModel.destroy({ where: { id } });
    return deleted > 0;
  }
}
