// Mock electron before importing preload
const mockInvoke = jest.fn()
const mockOn = jest.fn()
const mockRemoveListener = jest.fn()
const mockExposeInMainWorld = jest.fn()

jest.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: mockExposeInMainWorld
  },
  ipcRenderer: {
    invoke: mockInvoke,
    on: mockOn,
    removeListener: mockRemoveListener
  }
}))

// Mock process.versions
Object.defineProperty(process, 'versions', {
  value: { electron: '29.0.0', node: '20.0.0', chrome: '122.0.0' },
  writable: true,
  configurable: true
})

// Now require the preload which triggers the exposure
require('../index')

// Capture the API from the module load
const api = mockExposeInMainWorld.mock.calls.length > 0
  ? mockExposeInMainWorld.mock.calls[mockExposeInMainWorld.mock.calls.length - 1][1]
  : {}

describe('Preload API', () => {
  beforeEach(() => {
    // Only clear the mock functions, not the mock record
    mockInvoke.mockClear()
    mockOn.mockClear()
    mockRemoveListener.mockClear()
    // Note: Don't clear mockExposeInMainWorld as it was called during module load
  })

  afterEach(() => {
    mockInvoke.mockClear()
    mockOn.mockClear()
    mockRemoveListener.mockClear()
  })

  describe('API exposure', () => {
    it('should expose API under vtest namespace', () => {
      expect(mockExposeInMainWorld).toHaveBeenCalledWith('vtest', expect.any(Object))
    })
  })

  describe('getVersions', () => {
    it('should return version info', () => {
      const versions = api.getVersions()
      expect(versions).toEqual({ electron: '29.0.0', node: '20.0.0', chrome: '122.0.0' })
    })
  })

  describe('OAuth methods', () => {
    it('should invoke oauth:authorize', async () => {
      mockInvoke.mockResolvedValue({ url: 'https://auth.com' })
      await api.oauthAuthorize({ clientId: '123' })
      expect(mockInvoke).toHaveBeenCalledWith('oauth:authorize', { clientId: '123' })
    })

    it('should invoke oauth:token', async () => {
      mockInvoke.mockResolvedValue({ token: 'abc' })
      await api.oauthToken({ code: 'auth-code' })
      expect(mockInvoke).toHaveBeenCalledWith('oauth:token', { code: 'auth-code' })
    })
  })

  describe('project methods', () => {
    it('should invoke project:list', async () => {
      mockInvoke.mockResolvedValue([])
      await api.projectList()
      expect(mockInvoke).toHaveBeenCalledWith('project:list')
    })

    it('should invoke project:load', async () => {
      mockInvoke.mockResolvedValue({ id: '1' })
      await api.projectLoad('project-1')
      expect(mockInvoke).toHaveBeenCalledWith('project:load', 'project-1')
    })
  })

  describe('AVD methods', () => {
    it('should invoke avd:list', async () => {
      mockInvoke.mockResolvedValue([])
      await api.avdList()
      expect(mockInvoke).toHaveBeenCalledWith('avd:list')
    })

    it('should invoke avd:start', async () => {
      mockInvoke.mockResolvedValue({ success: true })
      await api.avdStart('pixel-4')
      expect(mockInvoke).toHaveBeenCalledWith('avd:start', 'pixel-4')
    })
  })

  describe('logger methods', () => {
    it('should invoke logger:info', async () => {
      await api.loggerInfo('test message')
      expect(mockInvoke).toHaveBeenCalledWith('logger:info', 'test message')
    })

    it('should invoke logger:error', async () => {
      await api.loggerError('error message')
      expect(mockInvoke).toHaveBeenCalledWith('logger:error', 'error message')
    })
  })

  describe('invoke with channel validation', () => {
    it('should invoke valid channel', async () => {
      mockInvoke.mockResolvedValue({})
      await api.invoke('project:list')
      expect(mockInvoke).toHaveBeenCalledWith('project:list')
    })

    it('should reject invalid channel', async () => {
      expect(() => api.invoke("invalid:channel")).toThrow("not allowed")
    })
  })

  describe('on with channel validation', () => {
    it('should subscribe to valid channel', () => {
      const listener = jest.fn()
      api.on('exploration:stateChanged', listener)
      expect(mockOn).toHaveBeenCalledWith('exploration:stateChanged', expect.any(Function))
    })

    it('should throw for invalid channel', () => {
      expect(() => api.on('invalid:channel', jest.fn())).toThrow('IPC channel')
    })

    it('should return unsubscribe function', () => {
      const unsubscribe = api.on('exploration:stateChanged', jest.fn())
      expect(typeof unsubscribe).toBe('function')
    })
  })

  describe('onExplorationStateChanged', () => {
    it('should subscribe to exploration:stateChanged', () => {
      api.onExplorationStateChanged(jest.fn())
      expect(mockOn).toHaveBeenCalledWith('exploration:stateChanged', expect.any(Function))
    })

    it('should return unsubscribe function', () => {
      const unsubscribe = api.onExplorationStateChanged(jest.fn())
      expect(typeof unsubscribe).toBe('function')
    })
  })

  describe('startExploration', () => {
    it('should invoke exploration:start', async () => {
      mockInvoke.mockResolvedValue({ success: true })
      await api.startExploration()
      expect(mockInvoke).toHaveBeenCalledWith('exploration:start')
    })
  })
})
