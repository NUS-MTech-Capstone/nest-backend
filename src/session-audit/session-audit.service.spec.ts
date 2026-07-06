import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import { SessionAuditService } from './session-audit.service';

describe('SessionAuditService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('lists audit sessions through Audit Service with filters', async () => {
    process.env.SESSION_AUDIT_URL = 'http://audit-service:8085/';
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ sessions: [{ sessionId: 'sess-1' }] }),
    });
    global.fetch = fetchMock;

    const service = new SessionAuditService();
    await expect(service.listSessions({
      userId: 'user-1',
      hostId: 'host-1',
      crId: 'cr-1',
      limit: '25',
      cursor: '50',
    })).resolves.toEqual({ sessions: [{ sessionId: 'sess-1' }] });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://audit-service:8085/sessions/audit?userId=user-1&hostId=host-1&crId=cr-1&limit=25&cursor=50',
      { method: 'GET' },
    );
  });

  it('lists audit records for a session', async () => {
    process.env.SESSION_AUDIT_URL = 'http://audit-service:8085';
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ records: [{ sequence: 1 }] }),
    });
    global.fetch = fetchMock;

    const service = new SessionAuditService();
    await expect(service.listRecords('sess-1', { cursor: '10' })).resolves.toEqual({
      records: [{ sequence: 1 }],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://audit-service:8085/sessions/sess-1/audit/records?cursor=10',
      { method: 'GET' },
    );
  });

  it('lists global audit records through Audit Service with filters', async () => {
    process.env.SESSION_AUDIT_URL = 'http://audit-service:8085';
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ records: [{ sequence: 1 }] }),
    });
    global.fetch = fetchMock;

    const service = new SessionAuditService();
    await expect(service.listRecordsGlobal({
      hostId: 'host-1',
      recordType: 'command',
      from: '2026-07-06T01:00:00Z',
      limit: '25',
    })).resolves.toEqual({ records: [{ sequence: 1 }] });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://audit-service:8085/sessions/audit/records?hostId=host-1&recordType=command&from=2026-07-06T01%3A00%3A00Z&limit=25',
      { method: 'GET' },
    );
  });

  it('lists metadata events through Audit Service with filters', async () => {
    process.env.SESSION_AUDIT_URL = 'http://audit-service:8085';
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ events: [{ eventId: 'evt-1' }], nextCursor: null }),
    });
    global.fetch = fetchMock;

    const service = new SessionAuditService();
    await expect(service.listMetadataEvents({
      eventType: 'SessionCreated',
      source: 'session-manager',
      sessionId: 'sess-1',
      from: '2026-07-06T01:00:00Z',
      limit: '25',
      cursor: '50',
    })).resolves.toEqual({ events: [{ eventId: 'evt-1' }], nextCursor: null });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://audit-service:8085/events?eventType=SessionCreated&source=session-manager&sessionId=sess-1&from=2026-07-06T01%3A00%3A00Z&limit=25&cursor=50',
      { method: 'GET' },
    );
  });

  it('fails when SESSION_AUDIT_URL is missing', async () => {
    delete process.env.SESSION_AUDIT_URL;
    const service = new SessionAuditService();

    await expect(service.listSessions({})).rejects.toThrow(ServiceUnavailableException);
  });

  it('maps Audit Service errors to bad gateway', async () => {
    process.env.SESSION_AUDIT_URL = 'http://audit-service:8085';
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 });

    const service = new SessionAuditService();
    await expect(service.listSessions({})).rejects.toThrow(BadGatewayException);
  });
});
