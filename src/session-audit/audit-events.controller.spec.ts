import { Test, TestingModule } from '@nestjs/testing';
import { AuditEventsController } from './audit-events.controller';
import { SessionAuditService } from './session-audit.service';

describe('AuditEventsController', () => {
  let controller: AuditEventsController;
  let service: { listMetadataEvents: jest.Mock };

  beforeEach(async () => {
    service = {
      listMetadataEvents: jest.fn().mockResolvedValue({ events: [], nextCursor: null }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditEventsController],
      providers: [{ provide: SessionAuditService, useValue: service }],
    }).compile();

    controller = module.get(AuditEventsController);
  });

  it('delegates metadata event filters', async () => {
    const query = { eventType: 'SessionCreated', source: 'session-manager', limit: '25' };
    await controller.listEvents(query);
    expect(service.listMetadataEvents).toHaveBeenCalledWith(query);
  });
});
