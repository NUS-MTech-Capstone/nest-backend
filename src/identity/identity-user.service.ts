import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminListGroupsForUserCommand,
  AdminRemoveUserFromGroupCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { DEV_USERS, ROLES } from '../auth/auth.constants';

export interface ManagedUser {
  username: string;
  email?: string;
  name?: string;
  enabled: boolean;
  status: string;
  roles: string[];
}

export interface CreateUserRequest {
  username: string;
  email: string;
  name?: string;
  roles: string[];
}

@Injectable()
export class IdentityUserService {
  private readonly mode = process.env.AUTH_MODE === 'alb' ? 'alb' : 'dev';

  private client?: CognitoIdentityProviderClient;

  private devUsers: ManagedUser[] = DEV_USERS.map((user) => ({
    username: user.username,
    email: user.email,
    name: user.name,
    enabled: true,
    status: 'CONFIRMED',
    roles: [...user.roles],
  }));

  private getClient(): CognitoIdentityProviderClient {
    if (!this.client) {
      this.client = new CognitoIdentityProviderClient({
        region: process.env.AWS_REGION,
      });
    }
    return this.client;
  }

  private get userPoolId(): string {
    const poolId = process.env.COGNITO_USER_POOL_ID;
    if (!poolId) {
      throw new Error('COGNITO_USER_POOL_ID must be set when AUTH_MODE=alb');
    }
    return poolId;
  }

  private validateRoles(roles: string[]): void {
    const invalid = roles.filter(
      (role) => !ROLES.includes(role as (typeof ROLES)[number]),
    );
    if (invalid.length > 0) {
      throw new BadRequestException(`Unknown roles: ${invalid.join(', ')}`);
    }
  }

  async listUsers(): Promise<ManagedUser[]> {
    if (this.mode === 'dev') {
      return this.devUsers;
    }

    const client = this.getClient();
    const response = await client.send(
      new ListUsersCommand({ UserPoolId: this.userPoolId, Limit: 60 }),
    );

    const users: ManagedUser[] = [];
    for (const user of response.Users ?? []) {
      const username = user.Username!;
      const groups = await client.send(
        new AdminListGroupsForUserCommand({
          UserPoolId: this.userPoolId,
          Username: username,
        }),
      );
      const attributes = Object.fromEntries(
        (user.Attributes ?? []).map((attr) => [attr.Name, attr.Value]),
      );
      users.push({
        username,
        email: attributes['email'],
        name: attributes['name'],
        enabled: user.Enabled ?? false,
        status: user.UserStatus ?? 'UNKNOWN',
        roles: (groups.Groups ?? []).map((group) => group.GroupName!),
      });
    }
    return users;
  }

  async createUser(request: CreateUserRequest): Promise<ManagedUser> {
    this.validateRoles(request.roles);

    if (this.mode === 'dev') {
      if (this.devUsers.some((user) => user.username === request.username)) {
        throw new BadRequestException(
          `User ${request.username} already exists`,
        );
      }
      const user: ManagedUser = {
        username: request.username,
        email: request.email,
        name: request.name,
        enabled: true,
        status: 'CONFIRMED',
        roles: request.roles,
      };
      this.devUsers.push(user);
      return user;
    }

    const client = this.getClient();
    await client.send(
      new AdminCreateUserCommand({
        UserPoolId: this.userPoolId,
        Username: request.username,
        UserAttributes: [
          { Name: 'email', Value: request.email },
          { Name: 'email_verified', Value: 'true' },
          ...(request.name ? [{ Name: 'name', Value: request.name }] : []),
        ],
      }),
    );
    for (const role of request.roles) {
      await client.send(
        new AdminAddUserToGroupCommand({
          UserPoolId: this.userPoolId,
          Username: request.username,
          GroupName: role,
        }),
      );
    }

    return {
      username: request.username,
      email: request.email,
      name: request.name,
      enabled: true,
      status: 'FORCE_CHANGE_PASSWORD',
      roles: request.roles,
    };
  }

  async setEnabled(username: string, enabled: boolean): Promise<ManagedUser> {
    if (this.mode === 'dev') {
      const user = this.findDevUser(username);
      user.enabled = enabled;
      return user;
    }

    const client = this.getClient();
    const command = enabled
      ? new AdminEnableUserCommand({
          UserPoolId: this.userPoolId,
          Username: username,
        })
      : new AdminDisableUserCommand({
          UserPoolId: this.userPoolId,
          Username: username,
        });
    await client.send(command);

    const users = await this.listUsers();
    const user = users.find((entry) => entry.username === username);
    if (!user) {
      throw new NotFoundException(`User ${username} not found`);
    }
    return user;
  }

  async setRoles(username: string, roles: string[]): Promise<ManagedUser> {
    this.validateRoles(roles);

    if (this.mode === 'dev') {
      const user = this.findDevUser(username);
      user.roles = [...roles];
      return user;
    }

    const client = this.getClient();
    const current = await client.send(
      new AdminListGroupsForUserCommand({
        UserPoolId: this.userPoolId,
        Username: username,
      }),
    );
    const currentRoles = (current.Groups ?? []).map(
      (group) => group.GroupName!,
    );

    for (const role of currentRoles.filter((r) => !roles.includes(r))) {
      await client.send(
        new AdminRemoveUserFromGroupCommand({
          UserPoolId: this.userPoolId,
          Username: username,
          GroupName: role,
        }),
      );
    }
    for (const role of roles.filter((r) => !currentRoles.includes(r))) {
      await client.send(
        new AdminAddUserToGroupCommand({
          UserPoolId: this.userPoolId,
          Username: username,
          GroupName: role,
        }),
      );
    }

    const users = await this.listUsers();
    const user = users.find((entry) => entry.username === username);
    if (!user) {
      throw new NotFoundException(`User ${username} not found`);
    }
    return user;
  }

  private findDevUser(username: string): ManagedUser {
    const user = this.devUsers.find((entry) => entry.username === username);
    if (!user) {
      throw new NotFoundException(`User ${username} not found`);
    }
    return user;
  }
}
