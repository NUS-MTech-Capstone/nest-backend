import { BadRequestException, NotFoundException } from '@nestjs/common';
import { IdentityUserService } from './identity-user.service';

const mockSend = jest.fn();

jest.mock('@aws-sdk/client-cognito-identity-provider', () => ({
  CognitoIdentityProviderClient: jest.fn().mockImplementation(() => ({
    send: mockSend,
  })),
  ListUsersCommand: jest.fn().mockImplementation((input) => ({ input, _type: 'ListUsers' })),
  AdminListGroupsForUserCommand: jest
    .fn()
    .mockImplementation((input) => ({ input, _type: 'AdminListGroupsForUser' })),
  AdminCreateUserCommand: jest
    .fn()
    .mockImplementation((input) => ({ input, _type: 'AdminCreateUser' })),
  AdminAddUserToGroupCommand: jest
    .fn()
    .mockImplementation((input) => ({ input, _type: 'AdminAddUserToGroup' })),
  AdminRemoveUserFromGroupCommand: jest
    .fn()
    .mockImplementation((input) => ({ input, _type: 'AdminRemoveUserFromGroup' })),
  AdminEnableUserCommand: jest
    .fn()
    .mockImplementation((input) => ({ input, _type: 'AdminEnableUser' })),
  AdminDisableUserCommand: jest
    .fn()
    .mockImplementation((input) => ({ input, _type: 'AdminDisableUser' })),
}));

describe('IdentityUserService', () => {
  let service: IdentityUserService;
  const originalAuthMode = process.env.AUTH_MODE;
  const originalPoolId = process.env.COGNITO_USER_POOL_ID;

  beforeEach(() => {
    mockSend.mockReset();
    delete process.env.AUTH_MODE;
    delete process.env.COGNITO_USER_POOL_ID;
    service = new IdentityUserService();
  });

  afterEach(() => {
    if (originalAuthMode === undefined) {
      delete process.env.AUTH_MODE;
    } else {
      process.env.AUTH_MODE = originalAuthMode;
    }
    if (originalPoolId === undefined) {
      delete process.env.COGNITO_USER_POOL_ID;
    } else {
      process.env.COGNITO_USER_POOL_ID = originalPoolId;
    }
  });

  describe('dev mode', () => {
    it('listUsers returns seeded dev users', async () => {
      const users = await service.listUsers();

      expect(users.length).toBeGreaterThan(0);
      expect(users.some((user) => user.username === 'admin.dev')).toBe(true);
      expect(users.find((user) => user.username === 'admin.dev')?.sub).toBe('dev-admin.dev');
      expect(users.every((user) => user.enabled)).toBe(true);
    });

    it('createUser adds a new dev user', async () => {
      const created = await service.createUser({
        username: 'new.dev',
        email: 'new@example.com',
        name: 'New Dev',
        roles: ['Employee'],
      });

      expect(created).toEqual(
        expect.objectContaining({
          username: 'new.dev',
          sub: 'dev-new.dev',
          email: 'new@example.com',
          roles: ['Employee'],
          enabled: true,
          status: 'CONFIRMED',
        }),
      );
      expect(await service.listUsers()).toEqual(
        expect.arrayContaining([expect.objectContaining({ username: 'new.dev' })]),
      );
    });

    it('createUser rejects duplicate usernames', async () => {
      await expect(
        service.createUser({
          username: 'admin.dev',
          email: 'dup@example.com',
          roles: ['Employee'],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('createUser rejects unknown roles', async () => {
      await expect(
        service.createUser({
          username: 'bad.dev',
          email: 'bad@example.com',
          roles: ['NotARealRole'],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('setEnabled toggles a dev user', async () => {
      const disabled = await service.setEnabled('admin.dev', false);
      expect(disabled.enabled).toBe(false);

      const enabled = await service.setEnabled('admin.dev', true);
      expect(enabled.enabled).toBe(true);
    });

    it('setEnabled throws when user is missing', async () => {
      await expect(service.setEnabled('missing.dev', false)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('setRoles updates dev user roles', async () => {
      const updated = await service.setRoles('employee.dev', ['Manager', 'Employee']);

      expect(updated.roles).toEqual(['Manager', 'Employee']);
    });

    it('setRoles rejects unknown roles', async () => {
      await expect(
        service.setRoles('employee.dev', ['Employee', 'InvalidRole']),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('alb mode', () => {
    beforeEach(() => {
      process.env.AUTH_MODE = 'alb';
      process.env.COGNITO_USER_POOL_ID = 'ap-southeast-1_testpool';
      service = new IdentityUserService();
    });

    it('throws when COGNITO_USER_POOL_ID is missing', async () => {
      delete process.env.COGNITO_USER_POOL_ID;
      service = new IdentityUserService();

      await expect(service.listUsers()).rejects.toThrow(
        'COGNITO_USER_POOL_ID must be set when AUTH_MODE=alb',
      );
    });

    it('listUsers maps Cognito users and group memberships', async () => {
      mockSend
        .mockResolvedValueOnce({
          Users: [
            {
              Username: 'alice',
              Enabled: true,
              UserStatus: 'CONFIRMED',
              Attributes: [
                { Name: 'email', Value: 'alice@example.com' },
                { Name: 'name', Value: 'Alice' },
                { Name: 'sub', Value: 'user-123' },
              ],
            },
          ],
        })
        .mockResolvedValueOnce({
          Groups: [{ GroupName: 'Employee' }, { GroupName: 'Manager' }],
        });

      await expect(service.listUsers()).resolves.toEqual([
        {
          username: 'alice',
          sub: 'user-123',
          email: 'alice@example.com',
          name: 'Alice',
          enabled: true,
          status: 'CONFIRMED',
          roles: ['Employee', 'Manager'],
        },
      ]);
    });

    it('createUser provisions Cognito user and assigns groups', async () => {
      mockSend.mockResolvedValue({});

      await expect(
        service.createUser({
          username: 'bob',
          email: 'bob@example.com',
          name: 'Bob',
          roles: ['TechnicalStaff'],
        }),
      ).resolves.toEqual(
        expect.objectContaining({
          username: 'bob',
          email: 'bob@example.com',
          roles: ['TechnicalStaff'],
          status: 'FORCE_CHANGE_PASSWORD',
        }),
      );

      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it('setRoles adds and removes Cognito groups', async () => {
      mockSend
        .mockResolvedValueOnce({ Groups: [{ GroupName: 'Employee' }] })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({
          Users: [
            {
              Username: 'alice',
              Enabled: true,
              UserStatus: 'CONFIRMED',
              Attributes: [{ Name: 'email', Value: 'alice@example.com' }],
            },
          ],
        })
        .mockResolvedValueOnce({ Groups: [{ GroupName: 'Manager' }] });

      await expect(service.setRoles('alice', ['Manager'])).resolves.toEqual(
        expect.objectContaining({
          username: 'alice',
          roles: ['Manager'],
        }),
      );
    });
  });
});
