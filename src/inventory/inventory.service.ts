import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { CreateVmDto } from './dto/create-vm.dto';
import { UpdateVmDto } from './dto/update-vm.dto';
import { SyncVmRecord, SyncResult } from './dto/sync-vms.dto';
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
    return this.virtualMachineModel.findOne({ where: { hostname }, plain: true });
  }

  async findByIdOrHostname(hostId: string): Promise<VirtualMachine | null> {
    const byId = await this.findOne(hostId);
    if (byId) {
      return byId;
    }
    return this.findByHostname(hostId);
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

  /**
   * Upsert a list of server records by hostname.
   * Creates VMs that do not exist yet and updates those that do.
   */
  async sync(records: SyncVmRecord[]): Promise<SyncResult> {
    let created = 0;
    let updated = 0;
    let unchanged = 0;

    for (const record of records) {
      const existing = await this.virtualMachineModel.findOne({
        where: { hostname: record.hostname },
      });

      if (!existing) {
        await this.virtualMachineModel.create({
          hostname: record.hostname,
          ipAddress: record.ipAddress,
          assetStatus: record.assetStatus ?? AssetStatus.Active,
          osVersion: record.osVersion,
          sshPort: record.sshPort ?? 22,
          tags: record.tags ?? [],
        });
        created++;
      } else {
        let dirty = false;
        if (record.ipAddress !== existing.ipAddress) { existing.ipAddress = record.ipAddress; dirty = true; }
        if (record.osVersion !== existing.osVersion) { existing.osVersion = record.osVersion; dirty = true; }
        if (record.sshPort !== undefined && record.sshPort !== existing.sshPort) { existing.sshPort = record.sshPort; dirty = true; }
        if (record.assetStatus !== undefined && record.assetStatus !== existing.assetStatus) { existing.assetStatus = record.assetStatus; dirty = true; }
        if (record.tags !== undefined) { existing.tags = record.tags; dirty = true; }

        if (dirty) {
          await existing.save();
          updated++;
        } else {
          unchanged++;
        }
      }
    }

    return { created, updated, unchanged };
  }

  async setTags(id: string, tags: string[]): Promise<VirtualMachine | undefined> {
    const vm = await this.virtualMachineModel.findByPk(id);
    if (!vm) {
      return undefined;
    }
    const normalized = [...new Set(tags.map((t) => t.trim()).filter(Boolean))];
    vm.tags = normalized;
    return vm.save();
  }

  async remove(id: string): Promise<boolean> {
    const deleted = await this.virtualMachineModel.destroy({ where: { id } });
    return deleted > 0;
  }
}
