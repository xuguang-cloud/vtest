import { AVDManager } from '../AVDManager';
import { spawn } from 'child_process';

jest.mock('child_process');
jest.mock('../../logger/Logger');

describe('AVDManager', () => {
  let manager: AVDManager;
  const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;

  beforeEach(() => {
    jest.clearAllMocks();
    manager = new AVDManager();
  });

  describe('listAVDs', () => {
    it('should return list of AVDs', async () => {
      const mockStdout = { on: jest.fn() };
      const mockClose = { on: jest.fn() };
      mockSpawn.mockReturnValue({ stdout: mockStdout, on: mockClose } as any);

      setTimeout(() => {
        mockStdout.on.mock.calls.find(c => c[0] === 'data')?.[1](Buffer.from('avd1\navd2\n'));
        mockClose.mock.calls.find(c => c[0] === 'close')?.[1](0);
      }, 0);

      const avds = await manager.listAVDs();
      expect(avds).toEqual(['avd1', 'avd2']);
    });
  });

  describe('startAVD', () => {
    it('should start AVD with correct arguments', async () => {
      const mockProcess = {
        on: jest.fn(),
        stdout: { on: jest.fn() }
      };
      mockSpawn.mockReturnValue(mockProcess as any);

      await manager.startAVD('test_avd');

      expect(mockSpawn).toHaveBeenCalledWith('emulator', [
        '-avd', 'test_avd',
        '-no-snapshot',
        '-no-boot-anim',
        '-gpu', 'auto',
        '-no-audio'
      ]);
    });

    it('should emit statusChange when AVD starts', async () => {
      const mockProcess = {
        on: jest.fn(),
        stdout: { on: jest.fn() }
      };
      mockSpawn.mockReturnValue(mockProcess as any);

      const statusHandler = jest.fn();
      manager.on('statusChange', statusHandler);

      await manager.startAVD('test_avd');

      expect(statusHandler).toHaveBeenCalledWith({ name: 'test_avd', state: 'starting' });
    });
  });

  describe('getStatus', () => {
    it('should return initial status as stopped', () => {
      const status = manager.getStatus();
      expect(status.state).toBe('stopped');
    });
  });
});
