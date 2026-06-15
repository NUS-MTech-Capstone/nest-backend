import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../auth/decorators';
import {
  API_VERSION_HEADER,
  SERVICE_NAME,
  SUPPORTED_API_VERSION,
} from './service.constants';

@Injectable()
export class ApiVersionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest();
    const path: string = request.path ?? '';

    if (isPublic || path === '/healthz' || path === '/readyz') {
      return true;
    }

    const version = request.headers[API_VERSION_HEADER];
    if (version !== SUPPORTED_API_VERSION) {
      throw new BadRequestException(
        `Missing or unsupported ${API_VERSION_HEADER}. Expected "${SUPPORTED_API_VERSION}".`,
      );
    }

    return true;
  }
}
