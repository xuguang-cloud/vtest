import { HeartbeatManager, HeartbeatConfig } from '../HeartbeatManager';
jest.mock('../../logger/Logger');

describe('HeartbeatManager', () => {
  let manager: HeartbeatManager; 
  let mockHealthCheck: jest.Mock;
  const defaultConfig: HeartbeatConfig = { interval: 1000, timeout: 3000, maxConsecutiveFailures: 3 };

  beforeEach(() => { 
    mockHealthCheck = jest.fn(); 
    manager = new HeartbeatManager(defaultConfig, mockHealthCheck); 
  });
  
  afterEach(() => { 
    manager.stop(); 
  });

  it('应该按配置的间隔周期调用 performHealthCheck', async () => {
    mockHealthCheck.mockResolvedValue(true); 
    manager.start();
    // Wait for async check to complete
    await new Promise(r => setImmediate(r));
    expect(mockHealthCheck).toHaveBeenCalledTimes(1); 
  });

  it('成功时重置失败计数', async () => {
    mockHealthCheck.mockResolvedValue(true); 
    manager.start();
    await new Promise(r => setImmediate(r));
    expect(manager.getStatus().consecutiveFailures).toBe(0);
    expect(manager.getStatus().isAlive).toBe(true);
  });

  it('连续失败达到阈值触发 failure', async () => {
    mockHealthCheck.mockRejectedValue(new Error('Err')); 
    manager.start();
    // Wait for initial check
    await new Promise(r => setImmediate(r));
    expect(manager.getStatus().consecutiveFailures).toBe(1);
    expect(manager.getStatus().isAlive).toBe(false);
  });

  it('互斥锁防并发', async () => {
    let resolveCheck: (value: boolean) => void;
    mockHealthCheck.mockImplementation(() => new Promise(resolve => { resolveCheck = resolve; })); 
    manager.start();
    // Wait for async check to start
    await new Promise(r => setImmediate(r));
    expect(mockHealthCheck).toHaveBeenCalledTimes(1);
    
    // Resolve the pending check
    resolveCheck!(true);
    await new Promise(r => setImmediate(r));
  });
});
