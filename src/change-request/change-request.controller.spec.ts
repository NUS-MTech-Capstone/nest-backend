import { NotFoundException, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ChangeRequestController } from './change-request.controller';
import { ChangeRequestService } from './change-request.service';
import type { AuthUser } from '../auth/auth.types';
import { CreateChangeRequestDto } from './dto/create-change-request.dto';

describe('ChangeRequestController', () => {
  let controller: ChangeRequestController;
  let changeRequestService: {
    findAll: jest.Mock;
    findAccessible: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    approve: jest.Mock;
    reject: jest.Mock;
  };

  const user: AuthUser = {
    sub: '1',
    username: 'alice',
    roles: ['Employee'],
  };

  beforeEach(async () => {
    changeRequestService = {
      findAll: jest.fn(),
      findAccessible: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      approve: jest.fn(),
      reject: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChangeRequestController],
      providers: [
        { provide: ChangeRequestService, useValue: changeRequestService },
      ],
    }).compile();

    controller = module.get(ChangeRequestController);
  });

  it('findAll returns all change requests', () => {
    const requests = [{ id: 'cr-1' }];
    changeRequestService.findAll.mockReturnValue(requests);

    expect(controller.findAll()).toBe(requests);
  });

  it('findAccessible returns requests for user roles', () => {
    const requests = [{ id: 'cr-1' }];
    changeRequestService.findAccessible.mockReturnValue(requests);

    expect(controller.findAccessible(user)).toBe(requests);
    expect(changeRequestService.findAccessible).toHaveBeenCalledWith(
      user.roles,
    );
  });

  it('findOne returns a change request', async () => {
    const request = { id: 'cr-1' };
    changeRequestService.findOne.mockResolvedValue(request);

    await expect(controller.findOne('cr-1')).resolves.toBe(request);
  });

  it('findOne throws when request is missing', async () => {
    changeRequestService.findOne.mockResolvedValue(undefined);

    await expect(controller.findOne('missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('create delegates to service', () => {
    const dto = { title: 'Deploy' };
    const created = { id: 'cr-1', ...dto };
    changeRequestService.create.mockReturnValue(created);

    expect(controller.create(dto as never, user)).toBe(created);
    expect(changeRequestService.create).toHaveBeenCalledWith(
      dto,
      user.username,
    );
  });

  it('rejects a client-supplied requester field', async () => {
    const pipe = new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    await expect(
      pipe.transform(
        {
          title: 'Deploy',
          description: 'Deploy the approved release',
          approvalRoute: 'Manager',
          requester: 'spoofed-user',
        },
        { type: 'body', metatype: CreateChangeRequestDto },
      ),
    ).rejects.toMatchObject({
      response: {
        message: expect.arrayContaining([
          'property requester should not exist',
        ]),
      },
    });
  });

  it('update returns updated request', async () => {
    const updated = { id: 'cr-1', title: 'Updated' };
    changeRequestService.update.mockResolvedValue(updated);

    await expect(
      controller.update('cr-1', { title: 'Updated' } as never, user),
    ).resolves.toBe(updated);
  });

  it('update throws when request is missing', async () => {
    changeRequestService.update.mockResolvedValue(undefined);

    await expect(
      controller.update('missing', {} as never, user),
    ).rejects.toThrow(NotFoundException);
  });

  it('approve returns approved request', async () => {
    const approved = { id: 'cr-1', status: 'Approved' };
    changeRequestService.approve.mockResolvedValue(approved);

    await expect(controller.approve('cr-1', user)).resolves.toBe(approved);
  });

  it('reject throws when request is missing', async () => {
    changeRequestService.reject.mockResolvedValue(undefined);

    await expect(controller.reject('missing', user)).rejects.toThrow(
      NotFoundException,
    );
  });
});
