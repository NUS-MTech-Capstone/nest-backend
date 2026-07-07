import { BadRequestException, CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import {
  API_VERSION_HEADER,
  SUPPORTED_API_VERSION,
} from './service.constants';

@Injectable()
export class ApiVersionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const path: string = request.path ?? '';

    if (isApiVersionExempt(path)) {
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

function isApiVersionExempt(path: string): boolean {
  return [
    '/',
    '/healthz',
    '/readyz',
    '/openapi.yaml',
    '/ddm/auth/login',
    '/ddm/auth/logout',
    '/ddm/monitoring/alerts/webhook',
  ].includes(path);
}
