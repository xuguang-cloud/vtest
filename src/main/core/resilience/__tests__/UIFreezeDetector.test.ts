import { UIFreezeDetector, UIFreezeConfig } from '../UIFreezeDetector';
jest.mock('../../logger/Logger');

describe('UIFreezeDetector', () => {
  let detector: UIFreezeDetector; let mockGetUiHash: jest.Mock;
  const defaultConfig: UIFreezeConfig = { checkInterval: 5000, warningThreshold: 8000, freezeThreshold: 10000 };

  beforeEach(() => { mockGetUiHash = jest.fn(); detector = new UIFreezeDetector(defaultConfig, mockGetUiHash); jest.useFakeTimers(); });
  afterEach(() => { detector.stop(); jest.useRealTimers(); });

  it('UI 哈希变化时重置计时器', async () => {
    mockGetUiHash.mockResolvedValue('hash1'); detector.start(); await jest.advanceTimersByTimeAsync(0);
    mockGetUiHash.mockResolvedValue('hash2'); await jest.advanceTimersByTimeAsync(5000);
    expect(detector.getStatus().isWarning).toBe(false);
  });
  it('超过 warningThreshold 触发 warning', async () => {
    mockGetUiHash.mockResolvedValue('hash1'); detector.start(); await jest.advanceTimersByTimeAsync(0);
    await jest.advanceTimersByTimeAsync(8000); expect(detector.getStatus().isWarning).toBe(true);
  });
  it('超过 freezeThreshold 触发 freeze', async () => {
    mockGetUiHash.mockResolvedValue('hash1'); detector.start(); await jest.advanceTimersByTimeAsync(0);
    await jest.advanceTimersByTimeAsync(10000); expect(detector.getStatus().isFrozen).toBe(true);
  });
  it('冻结后恢复触发 unfreeze', async () => {
    mockGetUiHash.mockResolvedValue('hash1'); detector.start(); await jest.advanceTimersByTimeAsync(0);
    await jest.advanceTimersByTimeAsync(10000); expect(detector.getStatus().isFrozen).toBe(true);
    mockGetUiHash.mockResolvedValue('hash2'); await jest.advanceTimersByTimeAsync(5000);
    expect(detector.getStatus().isFrozen).toBe(false);
  });
});