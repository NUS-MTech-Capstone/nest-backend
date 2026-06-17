import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser, RequirePermission } from '../auth/decorators';
import type { AuthUser } from '../auth/auth.types';
import { CreateImplementerGroupDto } from './dto/create-implementer-group.dto';
import { CreateMembershipRequestDto } from './dto/create-membership-request.dto';
import { UpdateImplementerGroupDto } from './dto/update-implementer-group.dto';
import { ImplementerGroupService } from './implementer-group.service';
import { ImplementerGroupMembershipService } from './implementer-group-membership.service';
import { MembershipRequestStatus } from './implementer-group-membership-request.entity';

@Controller('implementer-groups')
export class ImplementerGroupController {
  constructor(
    private readonly implementerGroupService: ImplementerGroupService,
    private readonly membershipService: ImplementerGroupMembershipService,
  ) {}

  @Get('membership-requests')
  @RequirePermission('identity.users.manage')
  findMembershipRequests(@Query('status') status?: MembershipRequestStatus) {
    return this.membershipService.findAllRequests(status);
  }

  @Post('membership-requests')
  @RequirePermission('identity.users.manage')
  createMembershipRequest(@Body() dto: CreateMembershipRequestDto) {
    return this.membershipService.createRequest(dto);
  }

  @Patch('membership-requests/:id/approve')
  @RequirePermission('identity.users.manage')
  approveMembershipRequest(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.membershipService.approve(
      id,
      user.name || user.username,
    );
  }

  @Patch('membership-requests/:id/reject')
  @RequirePermission('identity.users.manage')
  rejectMembershipRequest(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.membershipService.reject(
      id,
      user.name || user.username,
    );
  }

  @Get(':id/members')
  @RequirePermission('identity.users.manage')
  findMembers(@Param('id') id: string) {
    return this.membershipService.findMembers(id);
  }

  @Delete(':id/members/:username')
  @RequirePermission('identity.users.manage')
  removeMember(
    @Param('id') id: string,
    @Param('username') username: string,
  ) {
    return this.membershipService.removeMember(id, username);
  }

  @Get('accessible-vms')
  @RequirePermission('access.view')
  findAccessibleVms(@CurrentUser() user: AuthUser) {
    return this.membershipService.findAccessibleAssets(
      user.username,
      user.roles,
    );
  }

  @Get()
  @RequirePermission('change.view')
  findAll() {
    return this.implementerGroupService.findAll();
  }

  @Get(':id')
  @RequirePermission('change.view')
  async findOne(@Param('id') id: string) {
    const group = await this.implementerGroupService.findOne(id);
    if (!group) {
      throw new NotFoundException(`Implementer group ${id} not found`);
    }
    return group;
  }

  @Post()
  @RequirePermission('identity.users.manage')
  create(@Body() dto: CreateImplementerGroupDto) {
    return this.implementerGroupService.create(dto);
  }

  @Patch(':id')
  @RequirePermission('identity.users.manage')
  async update(@Param('id') id: string, @Body() dto: UpdateImplementerGroupDto) {
    const updated = await this.implementerGroupService.update(id, dto);
    if (!updated) {
      throw new NotFoundException(`Implementer group ${id} not found`);
    }
    return updated;
  }

  @Delete(':id')
  @RequirePermission('identity.users.manage')
  async remove(@Param('id') id: string) {
    const removed = await this.implementerGroupService.remove(id);
    if (!removed) {
      throw new NotFoundException(`Implementer group ${id} not found`);
    }
    return { success: true };
  }
}
