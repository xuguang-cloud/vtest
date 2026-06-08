jest.mock('../../logger/Logger');

// Create a mock database connection
type MockDb = {
  (tableName: string): MockDb;
  insert(data: any): Promise<any>;
  where(conditions: any): MockDb;
  orderBy(column: string, direction: string): MockDb;
  first(): Promise<any>;
  del(): Promise<any>;
};

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
  let ExplorationSnapshot: any;

  beforeAll(() => {
    // Define mock before requiring the module
    const { mockDb } = createMockDb();
    jest.doMock('../../database/connection', () => ({
      getDatabase: () => mockDb
    }));
    const module = require('../CheckpointManager');
    CheckpointManager = module.CheckpointManager;
  });

  afterAll(() => {
    jest.dontMock('../../database/connection');
  });

  it('should be defined', () => {
    expect(CheckpointManager).toBeDefined();
  });
});
