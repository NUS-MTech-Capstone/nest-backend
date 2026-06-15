import { Test, TestingModule } from '@nestjs/testing';
import { IdentityController } from './identity.controller';
import { IdentityUserService } from './identity-user.service';
import { PolicyService } from './policy.service';
import { PERMISSIONS, ROLES } from '../auth/auth.constants';

describe('IdentityController', () => {
  let controller: IdentityController;
  let identityUserService: {
    listUsers: jest.Mock;
    createUser: jest.Mock;
    setEnabled: jest.Mock;
    setRoles: jest.Mock;
  };
  let policyService: {
    getMatrix: jest.Mock;
    updateMatrix: jest.Mock;
  };

  beforeEach(async () => {
    identityUserService = {
      listUsers: jest.fn(),
      createUser: jest.fn(),
      setEnabled: jest.fn(),
      setRoles: jest.fn(),
    };
    policyService = {
      getMatrix: jest.fn(),
      updateMatrix: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [IdentityController],
      providers: [
        { provide: IdentityUserService, useValue: identityUserService },
        { provide: PolicyService, useValue: policyService },
      ],
    }).compile();

    controller = module.get(IdentityController);
  });

  it('getRoles returns roles and permissions', () => {
    expect(controller.getRoles()).toEqual({
      roles: ROLES,
      permissions: PERMISSIONS,
    });
  });

  it('listUsers delegates to identity user service', () => {
    const users = [{ username: 'alice' }];
    identityUserService.listUsers.mockReturnValue(users);

    expect(controller.listUsers()).toBe(users);
  });

  it('createUser delegates to identity user service', () => {
    const body = { username: 'alice', name: 'Alice', roles: ['Employee'] };
    const created = { ...body, enabled: true };
    identityUserService.createUser.mockReturnValue(created);

    expect(controller.createUser(body as never)).toBe(created);
  });

  it('setStatus delegates to identity user service', () => {
    const updated = { username: 'alice', enabled: false };
    identityUserService.setEnabled.mockReturnValue(updated);

    expect(controller.setStatus('alice', { enabled: false })).toBe(updated);
    expect(identityUserService.setEnabled).toHaveBeenCalledWith('alice', false);
  });

  it('setRoles delegates to identity user service', () => {
    const updated = { username: 'alice', roles: ['Admin'] };
    identityUserService.setRoles.mockReturnValue(updated);

    expect(controller.setRoles('alice', { roles: ['Admin'] })).toBe(updated);
    expect(identityUserService.setRoles).toHaveBeenCalledWith('alice', [
      'Admin',
    ]);
  });

  it('getPolicies returns policy matrix', () => {
    const matrix = [{ role: 'Admin', permissions: ['change.view'] }];
    policyService.getMatrix.mockReturnValue(matrix);

    expect(controller.getPolicies()).toBe(matrix);
  });

  it('updatePolicies delegates to policy service', () => {
    const policies = [{ role: 'Admin', permissions: ['change.view'] }];
    policyService.updateMatrix.mockReturnValue(policies);

    expect(controller.updatePolicies({ policies } as never)).toBe(policies);
    expect(policyService.updateMatrix).toHaveBeenCalledWith(policies);
  });
});
