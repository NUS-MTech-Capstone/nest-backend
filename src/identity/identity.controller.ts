import { Body, Controller, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { PERMISSIONS, ROLES } from '../auth/auth.constants';
import { RequirePermission } from '../auth/decorators';
import { IdentityUserService } from './identity-user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { SetUserRolesDto } from './dto/set-user-roles.dto';
import { SetUserStatusDto } from './dto/set-user-status.dto';
import { UpdatePoliciesDto } from './dto/update-policies.dto';
import { PolicyService } from './policy.service';

@Controller('identity')
export class IdentityController {
  constructor(
    private policyService: PolicyService,
    private identityUserService: IdentityUserService,
  ) {}

  @Get('roles')
  @RequirePermission('identity.users.manage')
  getRoles() {
    return { roles: ROLES, permissions: PERMISSIONS };
  }

  @Get('users')
  @RequirePermission('identity.users.manage')
  listUsers() {
    return this.identityUserService.listUsers();
  }

  @Post('users')
  @RequirePermission('identity.users.manage')
  createUser(@Body() body: CreateUserDto) {
    return this.identityUserService.createUser(body);
  }

  @Patch('users/:username/status')
  @RequirePermission('identity.users.manage')
  setStatus(
    @Param('username') username: string,
    @Body() body: SetUserStatusDto,
  ) {
    return this.identityUserService.setEnabled(username, body.enabled);
  }

  @Put('users/:username/roles')
  @RequirePermission('identity.users.manage')
  setRoles(@Param('username') username: string, @Body() body: SetUserRolesDto) {
    return this.identityUserService.setRoles(username, body.roles);
  }

  @Get('policies')
  @RequirePermission('identity.policies.manage')
  getPolicies() {
    return this.policyService.getMatrix();
  }

  @Put('policies')
  @RequirePermission('identity.policies.manage')
  updatePolicies(@Body() body: UpdatePoliciesDto) {
    return this.policyService.updateMatrix(body.policies);
  }
}
