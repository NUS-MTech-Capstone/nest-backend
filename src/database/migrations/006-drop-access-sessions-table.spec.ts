import { up } from './006-drop-access-sessions-table';

describe('006 drop access_sessions migration', () => {
  it('drops access_sessions when present', async () => {
    const context = {
      showAllTables: jest.fn().mockResolvedValue(['access_sessions']),
      dropTable: jest.fn().mockResolvedValue(undefined),
    };

    await up({ context } as never);

    expect(context.dropTable).toHaveBeenCalledWith('access_sessions', { cascade: true });
  });

  it('is a no-op when access_sessions is already absent', async () => {
    const context = {
      showAllTables: jest.fn().mockResolvedValue(['change_requests']),
      dropTable: jest.fn(),
    };

    await up({ context } as never);

    expect(context.dropTable).not.toHaveBeenCalled();
  });
});
