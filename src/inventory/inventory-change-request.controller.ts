import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  NotFoundException,
} from '@nestjs/common';
import { InventoryChangeRequestService } from './inventory-change-request.service';
import { CreateInventoryChangeRequestDto } from './dto/create-inventory-change-request.dto';
import { CurrentUser, RequirePermission } from '../auth/decorators';
import type { AuthUser } from '../auth/auth.types';

@Controller('inventory/change-requests')
export class InventoryChangeRequestController {
  constructor(
    private readonly inventoryChangeRequestService: InventoryChangeRequestService,
  ) {}

  @Get()
  @RequirePermission('inventory.view')
  findAll() {
    return this.inventoryChangeRequestService.findAll();
  }

  @Get(':id')
  @RequirePermission('inventory.view')
  async findOne(@Param('id') id: string) {
    const request = await this.inventoryChangeRequestService.findOne(id);
    if (!request) {
      throw new NotFoundException(
        `Inventory change request with ID ${id} not found`,
      );
    }
    return request;
  }

  @Post()
  @RequirePermission('inventory.request')
  create(
    @Body() dto: CreateInventoryChangeRequestDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.inventoryChangeRequestService.create(dto, user);
  }

  @Patch(':id/approve')
  @RequirePermission('inventory.approve')
  async approve(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const approved = await this.inventoryChangeRequestService.approve(id, user);
    if (!approved) {
      throw new NotFoundException(
        `Inventory change request with ID ${id} not found`,
      );
    }
    return approved;
  }

  @Patch(':id/reject')
  @RequirePermission('inventory.approve')
  async reject(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const rejected = await this.inventoryChangeRequestService.reject(id, user);
    if (!rejected) {
      throw new NotFoundException(
        `Inventory change request with ID ${id} not found`,
      );
    }
    return rejected;
  }
}
