import { up } from './005-backfill-access-sessions-table';

describe('005 backfill access_sessions migration', () => {
  it('creates access_sessions and indexes when the table is missing', async () => {
    const context = {
      showAllTables: jest.fn().mockResolvedValue(['change_requests']),
      createTable: jest.fn().mockResolvedValue(undefined),
      addIndex: jest.fn().mockResolvedValue(undefined),
    };

    await up({ context } as never);

    expect(context.createTable).toHaveBeenCalledWith(
      'access_sessions',
      expect.objectContaining({
        hostId: expect.any(Object),
        gatewaySessionId: expect.any(Object),
      }),
    );
    expect(context.addIndex).toHaveBeenCalledWith(
      'access_sessions',
      expect.objectContaining({ name: 'access_sessions_active_host' }),
    );
    expect(context.addIndex).toHaveBeenCalledWith(
      'access_sessions',
      expect.objectContaining({ name: 'access_sessions_created_by_started' }),
    );
  });

  it('skips creation when access_sessions already exists', async () => {
    const context = {
      showAllTables: jest.fn().mockResolvedValue(['access_sessions']),
      createTable: jest.fn(),
      addIndex: jest.fn().mockResolvedValue(undefined),
    };

    await up({ context } as never);

    expect(context.createTable).not.toHaveBeenCalled();
  });
});
