import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './decorators';
import { TokenService } from './token.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
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
        throw new UnauthorizedException('Missing ALB authentication headers');
      }
      request.user = await this.tokenService.verifyAlbHeaders(
        oidcData,
        accessToken,
      );
      return true;
    }

    const header: string = request.headers['authorization'] || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    request.user = await this.tokenService.verify(token);
    return true;
  }
}
