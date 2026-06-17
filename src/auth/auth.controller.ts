import { Body, Controller, Get, Post } from '@nestjs/common';
import { DEV_USERS } from './auth.constants';
import type { AuthUser } from './auth.types';
import { CurrentUser, Public } from './decorators';
import { TokenService } from './token.service';
import { PolicyService } from '../identity/policy.service';

@Controller('auth')
export class AuthController {
  constructor(
    private tokenService: TokenService,
    private policyService: PolicyService,
  ) {}

  @Public()
  @Get('config')
  getConfig() {
    return {
      mode: this.tokenService.mode,
      devUsers:
        this.tokenService.mode === 'dev'
          ? DEV_USERS.map(({ username, name, roles }) => ({
              username,
              name,
              roles,
            }))
          : [],
    };
  }

  @Public()
  @Post('dev-login')
  devLogin(@Body() body: { username: string }) {
    return this.tokenService.issueDevToken(body.username);
  }

  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    const permissions = await this.policyService.getPermissionsForRoles(
      user.roles,
    );
    return { ...user, permissions: [...permissions].sort() };
  }
}
