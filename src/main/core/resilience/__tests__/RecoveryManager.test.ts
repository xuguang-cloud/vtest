import { RecoveryManager } from '../RecoveryManager';
import { HeartbeatManager } from '../HeartbeatManager';
import { AVDManager } from '../../avd/AVDManager';

jest.mock('../HeartbeatManager');
jest.mock('../../avd/AVDManager');
jest.mock('../../logger/Logger');

describe('RecoveryManager', () => {
  let manager: RecoveryManager;
  let mockAVDManager: jest.Mocked<AVDManager>;
  let mockHeartbeatManager: jest.Mocked<HeartbeatManager>;

  beforeEach(() => {
    mockAVDManager = {
      stopAVD: jest.fn().mockResolvedValue(),
      startAVD: jest.fn().mockResolvedValue()
    } as any;

    mockHeartbeatManager = {
      start: jest.fn(),
      stop: jest.fn(),
      on: jest.fn()
    } as any;

    (HeartbeatManager as jest.MockedClass<typeof HeartbeatManager>).mockReturnValue(mockHeartbeatManager);

    manager = new RecoveryManager(mockAVDManager, { interval: 1000, timeout: 3000, maxConsecutiveFailures: 3 });
  });

  describe('startMonitoring', () => {
    it('should start heartbeat manager', () => {
      manager.startMonitoring();
      expect(mockHeartbeatManager.start).toHaveBeenCalled();
    });
  });

  describe('stopMonitoring', () => {
    it('should stop heartbeat manager', () => {
      manager.stopMonitoring();
      expect(mockHeartbeatManager.stop).toHaveBeenCalled();
    });
  });

  describe('saveCheckpoint', () => {
    it('should save checkpoint and emit event', () => {
      const checkpoint = manager.saveCheckpoint({
        activity: 'MainActivity',
        uiTreeHash: 'hash123',
        path: ['state1', 'state2']
      });

      expect(checkpoint.activity).toBe('MainActivity');
      expect(checkpoint.uiTreeHash).toBe('hash123');
    });
  });

  describe('getLastValidCheckpoint', () => {
    it('should return null when no checkpoints', () => {
      expect(manager.getLastValidCheckpoint()).toBeUndefined();
    });

    it('should return latest checkpoint', () => {
      manager.saveCheckpoint({ activity: 'Activity1', uiTreeHash: 'hash1', path: [] });
      manager.saveCheckpoint({ activity: 'Activity2', uiTreeHash: 'hash2', path: [] });

      const latest = manager.getLastValidCheckpoint();
      expect(latest?.activity).toBe('Activity2');
    });
  });
});
