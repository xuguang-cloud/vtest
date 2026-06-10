/**
 * VTest 应用配置常量
 * 统一管理所有硬编码常量，避免散落在各处代码中
 */

// ========================================
// Exploration Engine 配置
// ========================================
export const EXPLORATION = {
  DEFAULT_MAX_DEPTH: 20,
  DEFAULT_MAX_STEPS: 1000,
  DEFAULT_MAX_TIME_MS: 60000,
  DEFAULT_MAX_NODES: 1000,
  CHECKPOINT_INTERVAL: 20,
  MAX_CONSECUTIVE_CHECKPOINT_FAILURES: 3,
  UI_CHANGE_WAIT_MS: 2000,
  UI_STABLE_WAIT_MS: 500,
  DEFAULT_ACTIVITY: 'MainActivity',
  DEFAULT_PACKAGE: 'com.example.app',
  TIMEOUT_MS: 300000, // 5 minutes total exploration timeout
  ADB_SERIAL: 'emulator-5554',
} as const

// ========================================
// ADB / Device 配置
// ========================================
export const DEVICE = {
  ADB_TIMEOUT_MS: 10000,
  SHELL_TIMEOUT_MS: 5000,
  DEFAULT_PORT: 5554,
  SCREENSHOT_DIR: 'screenshots',
} as const

// ========================================
// Database 配置
// ========================================
export const DATABASE = {
  DEFAULT_FILENAME: 'vtest.db',
  MIGRATIONS_DIR: 'migrations',
  POOL_MIN: 2,
  POOL_MAX: 10,
  QUERY_TIMEOUT_MS: 5000,
} as const

// ========================================
// Security 配置
// ========================================
export const SECURITY = {
  ENCRYPTION_ALGORITHM: 'aes-256-gcm' as const,
  KEY_LENGTH: 32,
  IV_LENGTH: 16,
  KEY_STORAGE_FILENAME: '.vtest-master-key',
  JWT_EXPIRY_MS: 86400000, // 24 hours
  JWT_ALGORITHM: 'HS256' as const,
  RATE_LIMIT_MAX: 30,
  RATE_LIMIT_WINDOW_MS: 60000,
  RATE_LIMIT_BURST: 10,
} as const

// ========================================
// IPC 配置
// ========================================
export const IPC = {
  ALLOWED_INVOKE_CHANNELS: [
    'exploration:start',
    'exploration:stop',
    'exploration:pause',
    'exploration:resume',
    'oauth:authorize',
    'oauth:token',
    'project:list',
    'project:load',
    'avd:list',
    'avd:start',
    'logger:info',
    'logger:error',
  ] as const,
  ALLOWED_ON_CHANNELS: [
    'exploration:stateChanged',
    'oauth:callback',
    'logger:log',
  ] as const,
}

// ========================================
// Performance 配置
// ========================================
export const PERFORMANCE = {
  MEMORY_THRESHOLD: 0.8,
  MEMORY_MONITOR_INTERVAL_MS: 5000,
  WORKER_CONCURRENCY: 4,
  CACHE_L1_SIZE: 100,
  CACHE_L2_SIZE: 1000,
  CACHE_L3_ENABLED: false,
  STREAM_HIGH_WATER_MARK: 16,
  POOL_ACQUIRE_TIMEOUT_MS: 30000,
  TASK_QUEUE_CONCURRENCY: 4,
} as const

// ========================================
// Health Check 配置
// ========================================
export const HEALTH = {
  DEFAULT_TIMEOUT_MS: 5000,
  DEFAULT_INTERVAL_MS: 30000,
  MAX_HISTORY: 100,
  CIRCUIT_BREAKER_THRESHOLD: 5,
  CIRCUIT_BREAKER_RESET_MS: 30000,
  CIRCUIT_BREAKER_HALF_OPEN_MAX: 1,
  RETRY_MAX_ATTEMPTS: 3,
  RETRY_DELAY_MS: 1000,
  RETRY_BACKOFF: 2,
  RETRY_MAX_DELAY_MS: 30000,
  HEARTBEAT_INTERVAL_MS: 5000,
  HEARTBEAT_TIMEOUT_MS: 15000,
  HEARTBEAT_MAX_FAILURES: 3,
} as const

// ========================================
// Logging 配置
// ========================================
export const LOGGING = {
  LEVEL: 'info',
  ERROR_LOG_FILE: 'error.log',
  COMBINED_LOG_FILE: 'combined.log',
  SECURITY_LOG_FILE: 'security.log',
  MAX_FILE_SIZE_MB: 10,
  MAX_FILES: 5,
} as const

// ========================================
// UI / Renderer 配置
// ========================================
export const UI = {
  DEFAULT_WINDOW_WIDTH: 1200,
  DEFAULT_WINDOW_HEIGHT: 800,
  MIN_WINDOW_WIDTH: 800,
  MIN_WINDOW_HEIGHT: 600,
  DEV_SERVER_PORT: 5173,
  ANIMATION_DURATION_MS: 200,
} as const

// ========================================
// AVD 配置
// ========================================
export const AVD = {
  STOP_TIMEOUT_MS: 5000,
  DEFAULT_GPU: 'auto',
  DEFAULT_SCREEN_SIZE: '1080x1920',
  BOOT_TIMEOUT_MS: 120000,
} as const