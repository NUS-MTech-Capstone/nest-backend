import { up } from './004-implementation-window-columns';

describe('004 implementation window migration', () => {
  it('adds columns, backfills from scheduledDate, and enforces NOT NULL', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    let hasStart = false;
    let hasEnd = false;
    const context = {
      describeTable: jest.fn().mockImplementation(async () => {
        const desc: Record<string, { type: string }> = {
          scheduledDate: { type: 'DATE' },
        };
        if (hasStart) desc.implementationStartAt = { type: 'DATE' };
        if (hasEnd) desc.implementationEndAt = { type: 'DATE' };
        return desc;
      }),
      addColumn: jest.fn().mockImplementation(async (_table, column) => {
        if (column === 'implementationStartAt') hasStart = true;
        if (column === 'implementationEndAt') hasEnd = true;
      }),
      changeColumn: jest.fn().mockResolvedValue(undefined),
      sequelize: { query },
    };

    await up({ context } as never);

    expect(context.addColumn).toHaveBeenCalledWith(
      'change_requests',
      'implementationStartAt',
      expect.any(Object),
    );
    expect(context.addColumn).toHaveBeenCalledWith(
      'change_requests',
      'implementationEndAt',
      expect.any(Object),
    );
    expect(query).toHaveBeenCalledWith(expect.stringContaining('"scheduledDate"'));
    expect(context.changeColumn).toHaveBeenCalledWith(
      'change_requests',
      'implementationStartAt',
      expect.objectContaining({ allowNull: false }),
    );
    expect(context.changeColumn).toHaveBeenCalledWith(
      'change_requests',
      'implementationEndAt',
      expect.objectContaining({ allowNull: false }),
    );
  });

  it('backfills from createdAt when scheduledDate is absent', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const context = {
      describeTable: jest.fn().mockResolvedValue({
        implementationStartAt: { type: 'DATE' },
        implementationEndAt: { type: 'DATE' },
      }),
      addColumn: jest.fn(),
      changeColumn: jest.fn().mockResolvedValue(undefined),
      sequelize: { query },
    };

    await up({ context } as never);

    expect(context.addColumn).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledTimes(1);
    expect(String(query.mock.calls[0][0])).toContain('"createdAt"');
    expect(String(query.mock.calls[0][0])).not.toContain('"scheduledDate"');
    expect(context.changeColumn).toHaveBeenCalledTimes(2);
  });
});
