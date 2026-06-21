import { up } from './004-implementation-window-columns';

describe('004 implementation window migration', () => {
  it('adds columns, backfills from scheduledDate, and enforces NOT NULL', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const context = {
      describeTable: jest
        .fn()
        .mockResolvedValueOnce({
          scheduledDate: { type: 'DATE' },
        })
        .mockResolvedValueOnce({
          scheduledDate: { type: 'DATE' },
          implementationStartAt: { type: 'DATE' },
          implementationEndAt: { type: 'DATE' },
        }),
      addColumn: jest.fn().mockResolvedValue(undefined),
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
});
