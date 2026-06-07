import { HeartbeatManager, HeartbeatConfig } from '../HeartbeatManager';
jest.mock('../../logger/Logger');

describe('HeartbeatManager', () => {
  let manager: HeartbeatManager; let mockHealthCheck: jest.Mock;
  const defaultConfig: HeartbeatConfig = { interval: 10000, timeout: 3000, maxConsecutiveFailures: 3 };

  beforeEach(() => { mockHealthCheck = jest.fn(); manager = new HeartbeatManager(defaultConfig, mockHealthCheck); jest.useFakeTimers(); });
  afterEach(() => { manager.stop(); jest.useRealTimers(); });

  it('应该按配置的间隔周期调用 performHealthCheck', () => {
    mockHealthCheck.mockResolvedValue(true); manager.start();
    expect(mockHealthCheck).toHaveBeenCalledTimes(1); jest.advanceTimersByTime(10000);
    expect(mockHealthCheck).toHaveBeenCalledTimes(2);
  });
  it('成功时重置失败计数', async () => {
    mockHealthCheck.mockResolvedValue(true); manager.start(); await jest.advanceTimersByTimeAsync(0);
    expect(manager.getStatus().consecutiveFailures).toBe(0);
  });
  it('超时增加失败计数', async () => {
    mockHealthCheck.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 5000))); manager.start();
    await jest.advanceTimersByTimeAsync(4000); expect(manager.getStatus().consecutiveFailures).toBe(1);
  });
  it('连续失败达到阈值触发 failure', async () => {
    mockHealthCheck.mockRejectedValue(new Error('Err')); manager.start();
    for (let i = 0; i < 3; i++) await jest.advanceTimersByTimeAsync(10000);
    expect(manager.getStatus().consecutiveFailures).toBe(3);
  });
  it('互斥锁防并发', async () => {
    mockHealthCheck.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 15000))); manager.start();
    jest.advanceTimersByTime(10000); expect(mockHealthCheck).toHaveBeenCalledTimes(1);
  });
});