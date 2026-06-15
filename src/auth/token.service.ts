import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AlbJwtVerifier, CognitoJwtVerifier } from 'aws-jwt-verify';
import * as jwt from 'jsonwebtoken';
import { DEV_USERS } from './auth.constants';
import { AuthUser } from './auth.types';

export type AuthMode = 'alb' | 'dev';

@Injectable()
export class TokenService {
  readonly mode: AuthMode = process.env.AUTH_MODE === 'alb' ? 'alb' : 'dev';

  private readonly devSecret =
    process.env.DEV_JWT_SECRET || 'dev-secret-change-me';

  private albVerifier?: ReturnType<typeof AlbJwtVerifier.create>;
  private cognitoVerifier?: ReturnType<typeof CognitoJwtVerifier.create>;

  private getAlbVerifier() {
    if (!this.albVerifier) {
      const region = process.env.AWS_REGION;
      const userPoolId = process.env.COGNITO_USER_POOL_ID;
      const clientId = process.env.COGNITO_CLIENT_ID;
      const albArn = process.env.ALB_ARN;
      if (!region || !userPoolId || !clientId || !albArn) {
        throw new Error('ALB authentication configuration is incomplete');
      }
      this.albVerifier = AlbJwtVerifier.create({
        albArn,
        issuer:
          process.env.COGNITO_ISSUER ??
          `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`,
        clientId,
      });
    }
    return this.albVerifier;
  }

  private getCognitoVerifier() {
    if (!this.cognitoVerifier) {
      const userPoolId = process.env.COGNITO_USER_POOL_ID;
      const clientId = process.env.COGNITO_CLIENT_ID;
      if (!userPoolId || !clientId) {
        throw new Error('Cognito authentication configuration is incomplete');
      }
      this.cognitoVerifier = CognitoJwtVerifier.create({
        userPoolId,
        tokenUse: 'access',
        clientId,
      });
    }
    return this.cognitoVerifier;
  }

  async verifyDevToken(token: string): Promise<AuthUser> {
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

  async verifyAlbHeaders(
    claimsToken: string,
    accessToken: string,
  ): Promise<AuthUser> {
    try {
      const [claims, access] = await Promise.all([
        this.getAlbVerifier().verify(claimsToken),
        this.getCognitoVerifier().verify(accessToken),
      ]);
      if (!claims.sub || claims.sub !== access.sub) {
        throw new Error('ALB and Cognito subjects do not match');
      }

      return {
        sub: claims.sub,
        username:
          (claims['username'] as string | undefined) ??
          (access['username'] as string | undefined) ??
          claims.sub,
        email: claims['email'] as string | undefined,
        name: claims['name'] as string | undefined,
        roles: (access['cognito:groups'] as string[] | undefined) ?? [],
      };
    } catch {
      throw new UnauthorizedException('Invalid or expired ALB identity');
    }
  }

  issueDevToken(username: string): { accessToken: string; user: AuthUser } {
    if (this.mode !== 'dev') {
      throw new BadRequestException('Dev login is disabled when AUTH_MODE=alb');
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
