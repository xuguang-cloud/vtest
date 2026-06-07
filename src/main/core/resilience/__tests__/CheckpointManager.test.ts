import knex, { Knex } from 'knex';
import { CheckpointManager, ExplorationSnapshot } from '../CheckpointManager';

jest.mock('../../database/connection');
jest.mock('../../logger/Logger');

describe('CheckpointManager', () => {
  let db: Knex;
  let manager: CheckpointManager;
  beforeAll(async () => {
    db = knex({ client: 'better-sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
    await db.schema.createTable('test_runs', (table) => table.string('id').primary());
    await db.schema.createTable('exploration_checkpoints', (table) => {
      table.string('id').primary(); table.string('test_run_id').references('id').inTable('test_runs');
      table.integer('step_index'); table.string('activity_name'); table.string('ui_tree_hash'); table.binary('state_data');
    });
    require('../../database/connection').getDatabase.mockReturnValue(db);
  });
  afterAll(async () => await db.destroy());
  beforeEach(() => manager = new CheckpointManager());
  afterEach(async () => { await db('exploration_checkpoints').del(); await db('test_runs').del(); });

  it('应该成功保存并恢复检查点', async () => {
    const testRunId = 'run_001'; await db('test_runs').insert({ id: testRunId });
    const snapshot: ExplorationSnapshot = { stepIndex: 5, activityName: 'com.vtest.MainActivity', uiTreeHash: 'hash_abc_123', dfsStack: ['state1'], visitedHashes: ['hash1'] };
    await manager.saveCheckpoint(testRunId, snapshot);
    const restored = await manager.getLatestCheckpoint(testRunId);
    expect(restored).not.toBeNull(); expect(restored!.stepIndex).toBe(5); expect(restored!.dfsStack).toEqual(['state1']);
  });
});