/**
 * VTest 截屏辅助 + 日志轮转
 *
 * 功能:
 *   1. 日志轮转 — 保留最近 N 次运行日志，单次超限自动分割
 *   2. 步骤截屏 — 每次操作自动截屏保存到 screenshots/{run_id}/
 *   3. 录屏支持 — ADB screenrecord 录制操作过程
 *   4. 非调试模式 — --no-debug 关闭详细日志和截屏
 *   5. 定期清理 — 自动删除超过 N 天的截图和日志
 *
 * 目录结构:
 *   logs/
 *     run-exploration-20260609-193000.log   ← 当前运行日志 (自动轮转)
 *     run-exploration-20260609-190000.log   ← 上一次运行日志
 *     ...
 *   screenshots/
 *     20260609-193000/                      ← 按 run_id 分目录
 *       0001-after-click-continue.png
 *       0002-dialog2-checkbox.png
 *       ...
 *   recordings/
 *     20260609-193000-screenrecord.mp4      ← 录屏文件
 */

const fs = require('fs');
const path = require('path');

// ─── 配置 ──────────────────────────────────────────────
const CONFIG = {
  logDir: path.resolve(__dirname, '..', 'logs'),
  screenshotDir: path.resolve(__dirname, '..', 'screenshots'),
  recordingDir: path.resolve(__dirname, '..', 'recordings'),
  maxLogRetention: 5,       // 只保留最近 5 次运行日志
  maxLogSize: 1 * 1024 * 1024,  // 单次日志超过 1MB 自动分割
  maxScreenshotDays: 7,     // 截图保留 7 天
  maxRecordingDays: 3,      // 录屏保留 3 天
  debug: true               // 默认调试模式
};

// ─── 运行时状态 ────────────────────────────────────────
let runId = null;
let screenshotSeq = 0;
let currentLogFile = null;
let currentLogSeq = 1;
let currentLogSize = 0;
let isDebugMode = true;
let recordingPid = null;

// ─── 初始化 ────────────────────────────────────────────

function init(options = {}) {
  if (options.debug === false) {
    CONFIG.debug = false;
    isDebugMode = false;
  }

  // 生成 run ID
  const now = new Date();
  const ts = now.toISOString().replace(/[-:T]/g, '').substring(0, 15);
  runId = ts;

  // 确保目录存在
  [CONFIG.logDir, CONFIG.screenshotDir, CONFIG.recordingDir].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  // 日志轮转: 清理旧日志
  rotateLogs();

  // 打开当前日志文件
  currentLogFile = path.join(CONFIG.logDir, `run-exploration-${runId}_${currentLogSeq}.log`);
  currentLogSize = 0;

  // 清理过期截图和录屏
  cleanupOldScreenshots();
  cleanupOldRecordings();

  return runId;
}

// ─── 日志轮转 ──────────────────────────────────────────

function rotateLogs() {
  try {
    const files = fs.readdirSync(CONFIG.logDir)
      .filter(f => f.startsWith('run-exploration-') && f.endsWith('.log'))
      .map(f => {
        const fullPath = path.join(CONFIG.logDir, f);
        const stat = fs.statSync(fullPath);
        return { name: f, path: fullPath, mtime: stat.mtime };
      })
      .sort((a, b) => b.mtime - a.mtime);  // 最新的在前

    // 删除超过保留数量的旧文件
    const toDelete = files.slice(CONFIG.maxLogRetention);
    toDelete.forEach(f => {
      try { fs.unlinkSync(f.path); } catch (e) { /* ignore */ }
    });
  } catch (e) { /* ignore */ }
}

/**
 * 写入日志行
 */
function writeLog(level, msg) {
  if (!isDebugMode) return;

  const ts = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const line = `[${ts}][${level}] ${msg}\n`;

  // 检查是否超限
  currentLogSize += Buffer.byteLength(line, 'utf8');
  if (currentLogSize > CONFIG.maxLogSize) {
    // 创建新日志分片
    currentLogSeq++;
    currentLogFile = path.join(CONFIG.logDir,
      `run-exploration-${runId}_${currentLogSeq}.log`);
    currentLogSize = 0;
  }

  try {
    fs.appendFileSync(currentLogFile, line);
  } catch (e) { /* ignore */ }
  return line.trim();
}

// ─── 截屏 ─────────────────────────────────────────────

/**
 * 保存截图
 * @param {Buffer|string} imageData - 图片数据或 Base64
 * @param {string} label - 标签（如 'after-click', 'dialog-checkbox'）
 * @param {string} ext - 扩展名 (默认 png)
 * @returns {string|null} 截图路径或 null
 */
function saveScreenshot(imageData, label, ext = 'png') {
  if (!isDebugMode) return null;
  if (!runId) runId = init().runId;

  screenshotSeq++;
  const seqStr = String(screenshotSeq).padStart(4, '0');
  const filename = `${seqStr}-${label || 'capture'}.${ext}`;
  const runDir = path.join(CONFIG.screenshotDir, runId);
  if (!fs.existsSync(runDir)) fs.mkdirSync(runDir, { recursive: true });

  const filepath = path.join(runDir, filename);
  try {
    if (typeof imageData === 'string') {
      // Base64
      fs.writeFileSync(filepath, Buffer.from(imageData, 'base64'));
    } else if (Buffer.isBuffer(imageData)) {
      fs.writeFileSync(filepath, imageData);
    }
    return filepath;
  } catch (e) {
    return null;
  }
}

/**
 * 获取截屏目录路径
 */
function getScreenshotDir() {
  if (!runId) return null;
  return path.join(CONFIG.screenshotDir, runId);
}

/**
 * 清理过期截图（超过 CONFIG.maxScreenshotDays 天）
 */
function cleanupOldScreenshots() {
  const now = Date.now();
  const maxAge = CONFIG.maxScreenshotDays * 24 * 60 * 60 * 1000;

  try {
    const entries = fs.readdirSync(CONFIG.screenshotDir, { withFileTypes: true });
    entries.forEach(entry => {
      if (!entry.isDirectory()) return;
      const dirPath = path.join(CONFIG.screenshotDir, entry.name);
      const stat = fs.statSync(dirPath);
      if (now - stat.mtimeMs > maxAge) {
        fs.rmSync(dirPath, { recursive: true, force: true });
      }
    });
  } catch (e) { /* ignore */ }
}

// ─── 录屏 ─────────────────────────────────────────────

/**
 * 开始录屏 (Android only, 需要 ADB)
 *
 * @param {Function} execAdb - ADB 执行函数
 * @param {number} maxDuration - 最大录制时长(秒), 默认 180
 * @returns {Promise<string|null>} 录屏文件路径
 */
async function startRecording(execAdb, maxDuration = 180) {
  if (!isDebugMode) return null;
  if (!runId) runId = init().runId;

  const recDir = path.join(CONFIG.recordingDir, runId);
  if (!fs.existsSync(recDir)) fs.mkdirSync(recDir, { recursive: true });

  const devicePath = '/sdcard/vtest_screenrecord.mp4';
  // 先删掉旧的
  try { await execAdb(['shell', 'rm', '-f', devicePath], 3000); } catch (e) {}

  // 后台启动录屏
  try {
    await execAdb([
      'shell', 'screenrecord',
      '--time-limit', String(maxDuration),
      '--bit-rate', '4000000',  // 4Mbps
      '--verbose',
      devicePath
    ], 5000);
    recordingPid = runId;
    return path.join(recDir, `${runId}-screenrecord.mp4`);
  } catch (e) {
    return null;
  }
}

/**
 * 停止录屏并拉到本地
 *
 * @param {Function} execAdb - ADB 执行函数
 * @param {string} localPath - 本地保存路径
 * @returns {Promise<string|null>} 本地文件路径
 */
async function stopRecording(execAdb, localPath) {
  if (!recordingPid) return null;

  const devicePath = '/sdcard/vtest_screenrecord.mp4';

  try {
    // 终止录屏进程 (screenrecord 常驻进程)
    await execAdb(['shell', 'pkill', '-INT', 'screenrecord'], 3000);
    // 等待文件写入完成
    await new Promise(r => setTimeout(r, 2000));

    // 拉取到本地
    const pullPath = localPath || path.join(
      CONFIG.recordingDir, runId, `${runId}-screenrecord.mp4`
    );
    const pullDir = path.dirname(pullPath);
    if (!fs.existsSync(pullDir)) fs.mkdirSync(pullDir, { recursive: true });

    await execAdb(['pull', devicePath, pullPath], 30000);
    recordingPid = null;
    return pullPath;
  } catch (e) {
    recordingPid = null;
    return null;
  }
}

/**
 * 清理过期录屏（超过 CONFIG.maxRecordingDays 天）
 */
function cleanupOldRecordings() {
  const now = Date.now();
  const maxAge = CONFIG.maxRecordingDays * 24 * 60 * 60 * 1000;

  try {
    const entries = fs.readdirSync(CONFIG.recordingDir, { recursive: true });
    // entries includes files at all levels
    entries.forEach(name => {
      const fp = path.join(CONFIG.recordingDir, name);
      try {
        const stat = fs.statSync(fp);
        if (stat.isFile() && now - stat.mtimeMs > maxAge) {
          fs.unlinkSync(fp);
        }
      } catch (e) { /* ignore */ }
    });

    // 清理空目录
    const dirEntries = fs.readdirSync(CONFIG.recordingDir, { withFileTypes: true });
    dirEntries.forEach(entry => {
      if (!entry.isDirectory()) return;
      const dp = path.join(CONFIG.recordingDir, entry.name);
      try {
        const files = fs.readdirSync(dp);
        if (files.length === 0) fs.rmdirSync(dp);
      } catch (e) { /* ignore */ }
    });
  } catch (e) { /* ignore */ }
}

// ─── 调试模式控制 ─────────────────────────────────────

function disableDebug() {
  isDebugMode = false;
  CONFIG.debug = false;
}

function enableDebug() {
  isDebugMode = true;
  CONFIG.debug = true;
}

function getRunId() {
  return runId;
}

function getCurrentLogFile() {
  return currentLogFile;
}

module.exports = {
  init,
  writeLog,
  saveScreenshot,
  getScreenshotDir,
  getRunId,
  getCurrentLogFile,
  startRecording,
  stopRecording,
  disableDebug,
  enableDebug,
  rotateLogs,
  cleanupOldScreenshots,
  cleanupOldRecordings
};