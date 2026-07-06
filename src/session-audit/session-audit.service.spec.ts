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

  it('lists audit sessions through Session Manager with filters', async () => {
    process.env.SESSION_MANAGER_URL = 'http://session-manager:8081/';
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
      'http://session-manager:8081/sessions/audit?userId=user-1&hostId=host-1&crId=cr-1&limit=25&cursor=50',
      { method: 'GET' },
    );
  });

  it('lists audit records for a session', async () => {
    process.env.SESSION_MANAGER_URL = 'http://session-manager:8081';
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
      'http://session-manager:8081/sessions/sess-1/audit/records?cursor=10',
      { method: 'GET' },
    );
  });

  it('fails when SESSION_MANAGER_URL is missing', async () => {
    delete process.env.SESSION_MANAGER_URL;
    const service = new SessionAuditService();

    await expect(service.listSessions({})).rejects.toThrow(ServiceUnavailableException);
  });

  it('maps Session Manager errors to bad gateway', async () => {
    process.env.SESSION_MANAGER_URL = 'http://session-manager:8081';
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 });

    const service = new SessionAuditService();
    await expect(service.listSessions({})).rejects.toThrow(BadGatewayException);
  });
});
