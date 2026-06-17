import { Body, Controller, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { PERMISSIONS, ROLES } from '../auth/auth.constants';
import { RequirePermission } from '../auth/decorators';
import { IdentityUserService } from './identity-user.service';
import type { CreateUserRequest } from './identity-user.service';
import { PolicyService } from './policy.service';
import type { PolicyRow } from './policy.service';

@Controller('identity')
export class IdentityController {
  constructor(
    private policyService: PolicyService,
    private identityUserService: IdentityUserService,
  ) {}

  @Get('roles')
  @RequirePermission('identity.users.view')
  getRoles() {
    return { roles: ROLES, permissions: PERMISSIONS };
  }

  @Get('users')
  @RequirePermission('identity.users.view')
  listUsers() {
    return this.identityUserService.listUsers();
  }

  @Post('users')
  @RequirePermission('identity.users.manage')
  createUser(@Body() body: CreateUserRequest) {
    return this.identityUserService.createUser(body);
  }

  @Patch('users/:username/status')
  @RequirePermission('identity.users.manage')
  setStatus(
    @Param('username') username: string,
    @Body() body: { enabled: boolean },
  ) {
    return this.identityUserService.setEnabled(username, body.enabled);
  }

  @Put('users/:username/roles')
  @RequirePermission('identity.users.manage')
  setRoles(
    @Param('username') username: string,
    @Body() body: { roles: string[] },
  ) {
    return this.identityUserService.setRoles(username, body.roles);
  }

  @Get('policies')
  @RequirePermission('identity.policies.manage')
  getPolicies() {
    return this.policyService.getMatrix();
  }

  @Put('policies')
  @RequirePermission('identity.policies.manage')
  updatePolicies(@Body() body: { policies: PolicyRow[] }) {
    return this.policyService.updateMatrix(body.policies);
  }
}
