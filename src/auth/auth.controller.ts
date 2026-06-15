import { Body, Controller, Get, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { DEV_USERS } from './auth.constants';
import type { AuthUser } from './auth.types';
import { CurrentUser, Public } from './decorators';
import { DevLoginDto } from './dto/dev-login.dto';
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
  @Get('login')
  login(@Res() response: Response): void {
    response.redirect(process.env.APP_LOGIN_REDIRECT ?? '/access');
  }

  @Public()
  @Get('logout')
  logout(@Res() response: Response): void {
    const cookieName =
      process.env.ALB_AUTH_COOKIE_NAME ?? 'AWSELBAuthSessionCookie';
    const cookieOptions = {
      path: '/',
      secure: true,
      sameSite: 'none' as const,
    };
    response.clearCookie(cookieName, cookieOptions);
    for (let index = 0; index < 4; index += 1) {
      response.clearCookie(`${cookieName}-${index}`, cookieOptions);
    }

    const domain = process.env.COGNITO_DOMAIN;
    const clientId = process.env.COGNITO_CLIENT_ID;
    const logoutUri = process.env.APP_LOGOUT_URI;
    if (domain && clientId && logoutUri) {
      const query = new URLSearchParams({
        client_id: clientId,
        logout_uri: logoutUri,
      });
      response.redirect(`https://${domain}/logout?${query.toString()}`);
      return;
    }
    response.redirect('/login');
  }

  @Public()
  @Post('dev-login')
  devLogin(@Body() body: DevLoginDto) {
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
