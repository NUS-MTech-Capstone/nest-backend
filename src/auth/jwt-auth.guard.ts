import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './decorators';
import { TokenService } from './token.service';
import { emitCount, errorKind, requestIdFrom } from '../common/observability';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private reflector: Reflector,
    private tokenService: TokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();

    if (this.tokenService.mode === 'alb') {
      const oidcData = request.headers['x-amzn-oidc-data'] as
        | string
        | undefined;
      const accessToken = request.headers['x-amzn-oidc-accesstoken'] as
        | string
        | undefined;

      if (!oidcData || !accessToken) {
        emitCount('AuthFailures', { Component: 'nest_auth', Reason: 'missing_alb_headers' });
        this.logger.warn(
          JSON.stringify({
            event: 'AccessDenied',
            requestId: requestIdFrom(request),
            action: 'authenticate',
            mode: 'alb',
            status: 'denied',
            reason: 'missing_alb_headers',
            oidcData: oidcData ? 'present' : 'missing',
            accessToken: accessToken ? 'present' : 'missing',
          }),
        );
        throw new UnauthorizedException('Missing ALB authentication headers');
      }

      try {
        request.user = await this.tokenService.verifyAlbHeaders(
          oidcData,
          accessToken,
        );
      } catch (err) {
        emitCount('AuthFailures', { Component: 'nest_auth', Reason: errorKind(err) });
        this.logger.warn(
          JSON.stringify({
            event: 'AccessDenied',
            requestId: requestIdFrom(request),
            action: 'authenticate',
            mode: 'alb',
            status: 'denied',
            errorKind: errorKind(err),
          }),
        );
        throw err;
      }
      return true;
    }

    const header: string = request.headers['authorization'] || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      emitCount('AuthFailures', { Component: 'nest_auth', Reason: 'missing_bearer' });
      throw new UnauthorizedException('Missing bearer token');
    }

    try {
      request.user = await this.tokenService.verify(token);
    } catch (err) {
      emitCount('AuthFailures', { Component: 'nest_auth', Reason: errorKind(err) });
      throw err;
    }
    return true;
  }
}
