import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  NotFoundException,
} from '@nestjs/common';
import { ChangeRequestService } from './change-request.service';
import { CreateChangeRequestDto } from './dto/create-change-request.dto';
import { UpdateChangeRequestDto } from './dto/update-change-request.dto';
import { CurrentUser, RequirePermission } from '../auth/decorators';
import type { AuthUser } from '../auth/auth.types';

@Controller('change-requests')
export class ChangeRequestController {
  constructor(private readonly changeRequestService: ChangeRequestService) {}

  @Get()
  @RequirePermission('change.view')
  findAll() {
    return this.changeRequestService.findAll();
  }

  @Get('accessible')
  @RequirePermission('access.view')
  findAccessible(@CurrentUser() user: AuthUser) {
    return this.changeRequestService.findAccessible(user.roles);
  }

  @Get(':id')
  @RequirePermission('change.view')
  async findOne(@Param('id') id: string) {
    const request = await this.changeRequestService.findOne(id);
    if (!request) {
      throw new NotFoundException(`Change request with ID ${id} not found`);
    }
    return request;
  }

  @Post()
  @RequirePermission('change.create')
  create(
    @Body() createChangeRequestDto: CreateChangeRequestDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.changeRequestService.create(createChangeRequestDto, user);
  }

  @Patch(':id')
  @RequirePermission('change.update')
  async update(
    @Param('id') id: string,
    @Body() updateChangeRequestDto: UpdateChangeRequestDto,
  ) {
    const updated = await this.changeRequestService.update(
      id,
      updateChangeRequestDto,
    );
    if (!updated) {
      throw new NotFoundException(`Change request with ID ${id} not found`);
    }
    return updated;
  }

  @Patch(':id/approve')
  @RequirePermission('change.approve')
  async approve(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const approved = await this.changeRequestService.approve(id, user);
    if (!approved) {
      throw new NotFoundException(`Change request with ID ${id} not found`);
    }
    return approved;
  }

  @Patch(':id/reject')
  @RequirePermission('change.approve')
  async reject(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const rejected = await this.changeRequestService.reject(id, user);
    if (!rejected) {
      throw new NotFoundException(`Change request with ID ${id} not found`);
    }
    return rejected;
  }
}
