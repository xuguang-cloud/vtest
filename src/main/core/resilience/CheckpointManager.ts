import { getDatabase } from '../database/connection';
import { Logger } from '../logger/Logger';
import { v4 as uuidv4 } from 'uuid';

const logger = Logger.getLogger('resilience');

export interface ExplorationSnapshot {
  stepIndex: number;
  activityName: string;
  uiTreeHash: string;
  dfsStack: string[];
  visitedHashes: string[];
}

export class CheckpointManager {
  public async saveCheckpoint(testRunId: string, snapshot: ExplorationSnapshot): Promise<void> {
    const db = getDatabase();
    try {
      const stateData = Buffer.from(JSON.stringify({ dfsStack: snapshot.dfsStack, visitedHashes: snapshot.visitedHashes }), 'utf-8');
      await db('exploration_checkpoints').insert({
        id: uuidv4(), test_run_id: testRunId, step_index: snapshot.stepIndex,
        activity_name: snapshot.activityName, ui_tree_hash: snapshot.uiTreeHash, state_data: stateData,
      });
      logger.debug(`Checkpoint saved for run ${testRunId} at step ${snapshot.stepIndex}`);
    } catch (error) {
      logger.error(`Failed to save checkpoint: ${error}`); throw error;
    }
  }

  public async getLatestCheckpoint(testRunId: string): Promise<ExplorationSnapshot | null> {
    const db = getDatabase();
    try {
      const row = await db('exploration_checkpoints').where({ test_run_id: testRunId }).orderBy('step_index', 'desc').first();
      if (!row) return null;
      const stateObj = JSON.parse(row.state_data.toString('utf-8'));
      return { stepIndex: row.step_index, activityName: row.activity_name, uiTreeHash: row.ui_tree_hash, dfsStack: stateObj.dfsStack, visitedHashes: stateObj.visitedHashes };
    } catch (error) {
      logger.error(`Failed to retrieve checkpoint: ${error}`); return null;
    }
  }
}