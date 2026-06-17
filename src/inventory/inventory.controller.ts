import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Delete,
  NotFoundException,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { CreateVmDto } from './dto/create-vm.dto';
import { UpdateVmDto } from './dto/update-vm.dto';
import { SetTagsDto } from './dto/set-tags.dto';
import { SyncVmsDto } from './dto/sync-vms.dto';
import { RequirePermission } from '../auth/decorators';

@Controller('inventory/vms')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @RequirePermission('inventory.view')
  findAll() {
    return this.inventoryService.findAll();
  }

  /** Admin direct create — bypasses the change-request approval workflow. */
  @Post()
  @RequirePermission('inventory.manage')
  create(@Body() dto: CreateVmDto) {
    return this.inventoryService.create(dto);
  }

  /** Upsert a batch of server records by hostname (sync from external source). */
  @Post('sync')
  @RequirePermission('inventory.manage')
  async syncVms(@Body() dto: SyncVmsDto) {
    return this.inventoryService.sync(dto.servers);
  }

  @Get(':id')
  @RequirePermission('inventory.view')
  async findOne(@Param('id') id: string) {
    const vm = await this.inventoryService.findOne(id);
    if (!vm) {
      throw new NotFoundException(`Virtual machine with ID ${id} not found`);
    }
    return vm;
  }

  /** Admin direct update — bypasses the change-request approval workflow. */
  @Patch(':id')
  @RequirePermission('inventory.manage')
  async update(@Param('id') id: string, @Body() dto: UpdateVmDto) {
    const vm = await this.inventoryService.update(id, dto);
    if (!vm) {
      throw new NotFoundException(`Virtual machine with ID ${id} not found`);
    }
    return vm;
  }

  @Patch(':id/tags')
  @RequirePermission('inventory.request')
  async setTags(@Param('id') id: string, @Body() dto: SetTagsDto) {
    const vm = await this.inventoryService.setTags(id, dto.tags);
    if (!vm) {
      throw new NotFoundException(`Virtual machine with ID ${id} not found`);
    }
    return vm;
  }

  @Delete(':id')
  @RequirePermission('inventory.delete')
  async remove(@Param('id') id: string) {
    const deleted = await this.inventoryService.remove(id);
    if (!deleted) {
      throw new NotFoundException(`Virtual machine with ID ${id} not found`);
    }
    return { deleted: true };
  }
}
