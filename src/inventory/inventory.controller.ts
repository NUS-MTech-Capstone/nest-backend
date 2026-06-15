import {
  Controller,
  Get,
  Param,
  Delete,
  NotFoundException,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { RequirePermission } from '../auth/decorators';

@Controller('inventory/vms')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @RequirePermission('inventory.view')
  findAll() {
    return this.inventoryService.findAll();
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
