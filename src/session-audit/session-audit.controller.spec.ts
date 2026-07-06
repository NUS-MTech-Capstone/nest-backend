import { Test, TestingModule } from '@nestjs/testing';
import { SessionAuditController } from './session-audit.controller';
import { SessionAuditService } from './session-audit.service';

describe('SessionAuditController', () => {
  let controller: SessionAuditController;
  let service: {
    listSessions: jest.Mock;
    listRecords: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      listSessions: jest.fn().mockResolvedValue({ sessions: [] }),
      listRecords: jest.fn().mockResolvedValue({ records: [] }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SessionAuditController],
      providers: [{ provide: SessionAuditService, useValue: service }],
    }).compile();

    controller = module.get(SessionAuditController);
  });

  it('delegates session list filters', async () => {
    const query = { userId: 'user-1', limit: '20' };
    await controller.listSessions(query);
    expect(service.listSessions).toHaveBeenCalledWith(query);
  });

  it('delegates record queries by session ID', async () => {
    const query = { cursor: '10' };
    await controller.listRecords('sess-1', query);
    expect(service.listRecords).toHaveBeenCalledWith('sess-1', query);
  });
});
