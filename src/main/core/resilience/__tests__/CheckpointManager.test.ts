jest.mock('../../logger/Logger');

// Create a mock database connection

const createMockDb = (): any => {
  const mockDb = jest.fn() as any;
  const mockChain = {
    insert: jest.fn().mockResolvedValue([1]),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(0),
  };
  mockDb.mockReturnValue(mockChain);
  mockDb.schema = {
    createTable: jest.fn().mockResolvedValue(undefined),
  };
  return { mockDb, mockChain };
};

describe('CheckpointManager', () => {
  let CheckpointManager: any;

  beforeAll(() => {
    // Define mock before requiring the module
    const { mockDb } = createMockDb();
    jest.doMock('../../database/connection', () => ({
      getDatabase: () => mockDb
    }));
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const module = require('../CheckpointManager');
    CheckpointManager = module.CheckpointManager;
  });

  afterAll(() => {
    jest.dontMock('../../database/connection');
  });
  // eslint-disable-next-line @typescript-eslint/no-var-requires

  it('should be defined', () => {
    expect(CheckpointManager).toBeDefined();
  });
});
