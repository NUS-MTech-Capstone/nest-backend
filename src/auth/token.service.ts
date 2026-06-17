import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import * as jwt from 'jsonwebtoken';
import { DEV_USERS } from './auth.constants';
import { AuthUser } from './auth.types';

export type AuthMode = 'cognito' | 'dev';

@Injectable()
export class TokenService {
  readonly mode: AuthMode =
    process.env.AUTH_MODE === 'cognito' ? 'cognito' : 'dev';

  private readonly devSecret =
    process.env.DEV_JWT_SECRET || 'dev-secret-change-me';

  private cognitoVerifier?: ReturnType<typeof CognitoJwtVerifier.create>;

  private getCognitoVerifier() {
    if (!this.cognitoVerifier) {
      const userPoolId = process.env.COGNITO_USER_POOL_ID;
      const clientId = process.env.COGNITO_CLIENT_ID;
      if (!userPoolId || !clientId) {
        throw new Error(
          'COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID must be set when AUTH_MODE=cognito',
        );
      }
      this.cognitoVerifier = CognitoJwtVerifier.create({
        userPoolId,
        tokenUse: 'access',
        clientId,
      });
    }
    return this.cognitoVerifier;
  }

  async verify(token: string): Promise<AuthUser> {
    if (this.mode === 'cognito') {
      try {
        const payload = await this.getCognitoVerifier().verify(token);
        return {
          sub: payload.sub,
          username: (payload['username'] as string) || payload.sub,
          roles: (payload['cognito:groups'] as string[]) || [],
        };
      } catch {
        throw new UnauthorizedException('Invalid or expired token');
      }
    }

    try {
      const payload = jwt.verify(token, this.devSecret) as jwt.JwtPayload;
      return {
        sub: payload.sub || '',
        username: (payload['username'] as string) || payload.sub || '',
        email: payload['email'] as string | undefined,
        name: payload['name'] as string | undefined,
        roles: (payload['cognito:groups'] as string[]) || [],
      };
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  issueDevToken(username: string): { accessToken: string; user: AuthUser } {
    if (this.mode !== 'dev') {
      throw new BadRequestException(
        'Dev login is disabled when AUTH_MODE=cognito',
      );
    }

    const devUser = DEV_USERS.find((user) => user.username === username);
    if (!devUser) {
      throw new UnauthorizedException(`Unknown dev user: ${username}`);
    }

    const user: AuthUser = {
      sub: `dev-${devUser.username}`,
      username: devUser.username,
      email: devUser.email,
      name: devUser.name,
      roles: devUser.roles,
    };

    const accessToken = jwt.sign(
      {
        sub: user.sub,
        username: user.username,
        email: user.email,
        name: user.name,
        'cognito:groups': user.roles,
      },
      this.devSecret,
      { expiresIn: '8h' },
    );

    return { accessToken, user };
  }
}
