import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PolicyService } from '../identity/policy.service';
import { AuthUser } from './auth.types';
import { PERMISSION_KEY } from './decorators';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private policyService: PolicyService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permission = this.reflector.getAllAndOverride<string>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!permission) {
      return true;
    }

    const user: AuthUser | undefined = context
      .switchToHttp()
      .getRequest().user;
    if (!user) {
      throw new ForbiddenException('No authenticated user');
    }

    const granted = await this.policyService.getPermissionsForRoles(
      user.roles,
    );
    if (!granted.has(permission)) {
      throw new ForbiddenException(`Missing permission: ${permission}`);
    }
    return true;
  }
}
