import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { IdentityModule } from '../identity/identity.module';
import { ApiVersionGuard } from '../common/api-version.guard';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PermissionsGuard } from './permissions.guard';
import { TokenService } from './token.service';

@Module({
  imports: [IdentityModule],
  controllers: [AuthController],
  providers: [
    TokenService,
    { provide: APP_GUARD, useClass: ApiVersionGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  exports: [TokenService],
})
export class AuthModule {}
