import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { DEV_USERS } from './auth.constants';
import type { AuthUser } from './auth.types';
import { CurrentUser, Public } from './decorators';
import { TokenService } from './token.service';
import { PolicyService } from '../identity/policy.service';

const ALB_AUTH_COOKIE_SHARD_COUNT = 4;

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
  login(@Res() res: Response) {
    if (this.tokenService.mode !== 'alb') {
      throw new BadRequestException(
        'ALB login is only available when AUTH_MODE=alb',
      );
    }

    const redirect = process.env.APP_LOGIN_REDIRECT || '/access';
    res.redirect(redirect);
  }

  @Public()
  @Get('logout')
  logout(@Res() res: Response) {
    if (this.tokenService.mode !== 'alb') {
      throw new BadRequestException(
        'ALB logout is only available when AUTH_MODE=alb',
      );
    }

    const clientId = process.env.COGNITO_CLIENT_ID;
    const domain = process.env.COGNITO_DOMAIN;
    const logoutUri = encodeURIComponent(
      process.env.APP_LOGOUT_URI || '/login',
    );

    if (!clientId || !domain) {
      throw new BadRequestException(
        'COGNITO_CLIENT_ID and COGNITO_DOMAIN must be set for ALB logout',
      );
    }

    const cookieName =
      process.env.ALB_AUTH_COOKIE_NAME || 'AWSELBAuthSessionCookie';
    const cookieNames = [
      cookieName,
      ...Array.from(
        { length: ALB_AUTH_COOKIE_SHARD_COUNT },
        (_, index) => `${cookieName}-${index}`,
      ),
    ];

    for (const name of cookieNames) {
      res.clearCookie(name, {
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'none',
      });
    }
    res.set({
      'Cache-Control': 'no-store, max-age=0',
      Expires: '0',
      Pragma: 'no-cache',
    });

    res.redirect(
      `https://${domain}/logout?client_id=${clientId}&logout_uri=${logoutUri}`,
    );
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
