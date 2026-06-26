import { up, down } from './007-seed-presentation-data';

describe('007 seed presentation data migration', () => {
  it('skips seeding when marker VM already exists', async () => {
    const context = {
      sequelize: {
        query: jest.fn().mockResolvedValue([[{ id: 'existing' }], {}]),
      },
      bulkInsert: jest.fn(),
      bulkDelete: jest.fn(),
    };

    await up({ context } as never);

    expect(context.bulkInsert).not.toHaveBeenCalled();
  });

  it('inserts demo inventory, groups, changes, and alerts when empty', async () => {
    const context = {
      sequelize: {
        query: jest.fn().mockResolvedValue([[], {}]),
      },
      bulkInsert: jest.fn().mockResolvedValue(undefined),
      bulkDelete: jest.fn().mockResolvedValue(undefined),
    };

    await up({ context } as never);

    expect(context.bulkInsert).toHaveBeenCalledWith(
      'virtual_machines',
      expect.arrayContaining([
        expect.objectContaining({ hostname: 'web-prod-01' }),
        expect.objectContaining({ hostname: 'bastion-01' }),
      ]),
    );
    expect(context.bulkInsert).toHaveBeenCalledWith(
      'change_requests',
      expect.arrayContaining([
        expect.objectContaining({ status: 'Approved' }),
        expect.objectContaining({ status: 'Pending' }),
      ]),
    );
    expect(context.bulkInsert).toHaveBeenCalledWith(
      'alert_events',
      expect.arrayContaining([
        expect.objectContaining({ alarmName: 'HighCPU-web-prod-01' }),
      ]),
    );
  });

  it('removes seeded rows on down', async () => {
    const context = {
      bulkDelete: jest.fn().mockResolvedValue(undefined),
    };

    await down({ context } as never);

    expect(context.bulkDelete).toHaveBeenCalledWith(
      'virtual_machines',
      expect.objectContaining({
        id: expect.arrayContaining([
          'b0000001-0000-4000-8000-000000000001',
        ]),
      }),
    );
  });
});
