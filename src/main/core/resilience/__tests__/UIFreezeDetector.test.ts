import { UIFreezeDetector, UIFreezeConfig } from '../UIFreezeDetector';
jest.mock('../../logger/Logger');

describe('UIFreezeDetector', () => {
  let detector: UIFreezeDetector; 
  let mockGetUiHash: jest.Mock;
  const defaultConfig: UIFreezeConfig = { checkInterval: 5000, warningThreshold: 8000, freezeThreshold: 10000 };

  beforeEach(() => { 
    mockGetUiHash = jest.fn(); 
    detector = new UIFreezeDetector(defaultConfig, mockGetUiHash); 
  });
  
  afterEach(() => { 
    detector.stop(); 
  });

  it('初始状态应为未冻结', () => {
    expect(detector.getStatus().isFrozen).toBe(false);
    expect(detector.getStatus().isWarning).toBe(false);
  });

  it('UI 哈希变化时重置计时器', async () => {
    mockGetUiHash.mockResolvedValue('hash1'); 
    detector.start(); 
    // Wait for async detect to start
    await new Promise(r => setImmediate(r));
    expect(detector.getStatus().isWarning).toBe(false);
    expect(detector.getStatus().isFrozen).toBe(false);
  });

  it('stop后状态重置', () => {
    detector.start();
    detector.stop();
    const status = detector.getStatus();
    expect(status.isFrozen).toBe(false);
    expect(status.isWarning).toBe(false);
  });

  it('reset后状态重置', () => {
    detector.start();
    detector.reset();
    const status = detector.getStatus();
    expect(status.isFrozen).toBe(false);
    expect(status.isWarning).toBe(false);
    expect(status.consecutiveSameState).toBe(0);
  });
});
