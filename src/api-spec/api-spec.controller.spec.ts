import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ApiSpecController } from './api-spec.controller';
import { ApiSpecService } from './api-spec.service';

describe('ApiSpecController', () => {
  let controller: ApiSpecController;
  let apiSpecService: { readOpenAPI: jest.Mock };

  beforeEach(async () => {
    apiSpecService = { readOpenAPI: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApiSpecController],
      providers: [{ provide: ApiSpecService, useValue: apiSpecService }],
    }).compile();

    controller = module.get(ApiSpecController);
  });

  it('returns the OpenAPI document when present', () => {
    apiSpecService.readOpenAPI.mockReturnValue('openapi: 3.1.0');

    expect(controller.getOpenAPI()).toBe('openapi: 3.1.0');
    expect(apiSpecService.readOpenAPI).toHaveBeenCalled();
  });

  it('throws NotFoundException when the spec file is missing', () => {
    apiSpecService.readOpenAPI.mockReturnValue(undefined);

    expect(() => controller.getOpenAPI()).toThrow(NotFoundException);
  });
});
