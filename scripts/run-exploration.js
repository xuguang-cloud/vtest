#!/usr/bin/env node
/**
 * VTest CLI Runner — 多平台 APK 自动探索测试
 *
 * 支持: Android (华为/小米/OPPO/vivo/三星) / iOS / HarmonyOS
 * 元素类型: Native / Custom / React Native / Flutter / H5
 *
 * 用法:
 *   node scripts/run-exploration.js -a <apk> -p <package>
 *   node scripts/run-exploration.js -a <apk> -p <package> --no-debug
 *
 * 可选参数:
 *   -a / --apk           APK 路径 (必填)
 *   -p / --package       包名 (必填)
 *   -d / --depth         探索深度 (默认 10)
 *   -t / --timeout       超时秒数 (默认 60)
 *   -e / --export        报告导出路径 (默认 ./exploration-report.md)
 *   -n / --app-name      应用显示名（桌面搜索用，如"小米打印"）
 *   --adb-path           ADB 路径 (默认 D:/Tools/platform-tools/adb.exe)
 *   --serial             ADB 设备序列号 (默认自动选择)
 *   --no-debug           关闭调试日志 (只保留关键信息)
 *   --no-screenshot      关闭截屏 (调试模式下默认开启)
 *   --record             开启录屏 (默认关闭)
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// ─── 导入 DeviceProfile + 截屏辅助 + App探索引擎 ────────
const { detectDeviceProfile, inferElementType, getStrategyChain } = require('./device-profiles');
const screenshotHelper = require('./screenshot-helper');
const { AppExplorer } = require('./app-explorer');

// ─── 加载 .env 配置（华为密码等敏感信息） ─────────────────
try {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    // 简单解析 KEY="VALUE" 或 KEY=VALUE 格式
    const envRe = /^\s*(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))\s*$/gm;
    let em;
    while ((em = envRe.exec(envContent)) !== null) {
      const key = em[1];
      const val = em[2] || em[3] || em[4] || '';
      process.env[key] = val;
    }
    const pw = process.env.pw || process.env.HUAWEI_ACCOUNT_PASSWORD || '';
    if (pw) logToFile('INFO', '.env 已加载，华为密码可用');
    else logToFile('INFO', '.env 已加载，但未配置华为密码');
  }
} catch (e) { logToFile('INFO', '.env 加载失败: ' + e.message); }

// ─── CLI 参数解析 ──────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(short, long) {
  const idx = args.findIndex(a => a === short || a.startsWith(long + '=') || a === long);
  if (idx === -1) return '';
  if (args[idx].includes('=')) return args[idx].split('=')[1];
  return args[idx + 1] || '';
}
function hasFlag(name) { return args.includes(name); }

const APK_PATH       = getArg('-a', '--apk');
const PACKAGE_NAME   = getArg('-p', '--package');
const MAX_DEPTH      = parseInt(getArg('-d', '--depth') || '10', 10);
const TIMEOUT_S      = parseInt(getArg('-t', '--timeout') || '60', 10);
const EXPORT_PATH    = getArg('-e', '--export') || './exploration-report.md';
const ADB_PATH       = getArg('', '--adb-path') || 'D:/Tools/platform-tools/adb.exe';
const DEVICE_SERIAL  = getArg('', '--serial') || '';
const NO_DEBUG       = hasFlag('--no-debug');
const NO_SCREENSHOT  = hasFlag('--no-screenshot');
const DO_RECORD      = hasFlag('--record');
const APP_NAME       = getArg('-n', '--app-name') || '';

// ─── 初始化日志 & 截屏系统 ──────────────────────────────
const RUN_ID = screenshotHelper.init({ debug: !NO_DEBUG });
const doScreenshot = !NO_DEBUG && !NO_SCREENSHOT;

/** 日志函数 — 委托给 screenshotHelper */
function logToFile(level, msg) {
  return screenshotHelper.writeLog(level, msg);
}

/** 重写 console.log/error — debug模式下输出到日志 */
const origLog = console.log;
const origError = console.error;
if (!NO_DEBUG) {
  console.log = function() {
    const msg = Array.from(arguments).map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    origLog(msg);
    logToFile('INFO', msg);
  };
  console.error = function() {
    const msg = Array.from(arguments).map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    origError(msg);
    logToFile('ERROR', msg);
  };
}

// 写入日志头
logToFile('INFO', '═══════════════════════════════════════════');
logToFile('INFO', 'VTest CLI Runner v2.0 启动 (run=' + RUN_ID + ')');
logToFile('INFO', 'Args: ' + process.argv.slice(2).join(' '));
logToFile('INFO', 'Debug: ' + (!NO_DEBUG) + ' | Screenshot: ' + doScreenshot + ' | Record: ' + DO_RECORD);

// 进程退出记录
process.on('exit', function(code) {
  logToFile('INFO', '进程退出, code=' + code);
  logToFile('INFO', 'Log file: ' + screenshotHelper.getCurrentLogFile());
  if (DO_RECORD && !NO_DEBUG) {
    logToFile('INFO', 'Recordings dir: recordings/' + RUN_ID + '/');
  }
});
process.on('uncaughtException', function(err) {
  logToFile('ERROR', '未捕获异常: ' + (err && err.message || String(err)));
});

if (!APK_PATH || !PACKAGE_NAME) {
  console.log(`
用法: node scripts/run-exploration.js -a <apk-path> -p <package-name>

  必要参数:
    -a, --apk      待测试的 APK 文件路径
    -p, --package  应用包名 (如 com.huawei.myapp)

  可选参数:
    -d, --depth    探索深度 (默认 10)
    -t, --timeout  超时秒数 (默认 60)
    -e, --export   报告导出路径 (默认 ./exploration-report.md)
    --adb-path     ADB 路径 (默认 D:/Tools/platform-tools/adb.exe)
    --serial       ADB 设备序列号 (默认自动选择)

  示例:
    node scripts/run-exploration.js -a D:/test.apk -p com.huawei.myapp
`);
  process.exit(0);
}

// ─── ADB 工具 ──────────────────────────────────────────────────────
function execAdb(argsList, timeoutMs) {
  return new Promise((resolve, reject) => {
    const fullArgs = DEVICE_SERIAL ? ['-s', DEVICE_SERIAL, ...argsList] : [...argsList];
    const proc = spawn(ADB_PATH, fullArgs, { timeout: timeoutMs || 30000, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr.trim() || 'exit code ' + code));
    });
    proc.on('error', reject);
  });
}

function execAdbNoTimeout(argsList) {
  return new Promise((resolve, reject) => {
    const fullArgs = DEVICE_SERIAL ? ['-s', DEVICE_SERIAL, ...argsList] : [...argsList];
    const proc = spawn(ADB_PATH, fullArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr.trim() || 'exit code ' + code));
    });
    proc.on('error', reject);
  });
}

/**
 * 拼图安全验证 — 检测并自动拖动滑块
 *
 * 华为安装 APK 时在双弹窗后可能出现拼图验证（横线滑块拼图）
 * 通过 uiautomator dump 检测滑块元素，使用 ADB swipe 模拟拖动
 *
 * 策略：从左到右分步拖动滑块，每次移动 track 的 1/8 宽度
 * 完成后重试检测是否通过，未通过则从上次位置继续拖
 */
async function solveSliderPuzzle(maxAttempts) {
  maxAttempts = maxAttempts || 15;

  function dumpUI() {
    return execAdb(['shell', 'uiautomator', 'dump', '/sdcard/ui_slider.xml'], 5000)
      .then(() => execAdb(['shell', 'cat', '/sdcard/ui_slider.xml'], 3000))
      .catch(() => '');
  }

  // 查找滑块相关元素
  function findSliderElements(uiDump) {
    const results = { track: null, thumb: null };

    // 1. 查找 slider/seekbar 容器 (class 含 SeekBar 或 Slider)
    const containerRe = /<node[^>]*?class="[^"]*(?:SeekBar|Slider|滑块|拖动)[^"]*"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*?\/?>/i;
    let m = containerRe.exec(uiDump);
    if (m) {
      results.thumb = { bounds: [parseInt(m[1]), parseInt(m[2]), parseInt(m[3]), parseInt(m[4])] };
      // track 宽度 = thumb 容器宽度，作为拖动范围
      results.track = {
        x1: parseInt(m[1]),
        x2: parseInt(m[3]),
        y: Math.floor((parseInt(m[2]) + parseInt(m[4])) / 2)
      };
      return results;
    }

    // 2. 找 clickable 节点中文字含"拼图/滑动/验证/拖动/滑块"的
    const puzzleRe = /<node[^>]*?text="([^"]*(拼图|滑动|验证|拖动|滑块|安全验证|captcha)[^"]*)"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*?\/?>/i;
    m = puzzleRe.exec(uiDump);
    if (m) {
      const text = m[1];
      // 找到描述文字说明有拼图验证，用预设位置
      console.log('   检测到拼图验证: ' + text);
      // BAL-AL80 是 1080x1920 屏幕
      // 困难：不知道滑块的确切位置，需要猜测
      // 通常拼图滑块在屏幕 65%-75% 高度区域，是长条
      // 回退：使用全屏宽度尝试拖动
      return { track: { x1: 60, x2: 1020, y: 1600 }, thumb: { bounds: [60, 1560, 100, 1640] } };
    }

    return results;
  }

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const uiDump = await dumpUI();
      if (!uiDump) { await sleep(800); continue; }

      // 检测是否还在拼图界面（看有没有"拼图/滑动/验证"这类词）
      const hasPuzzle = /拼图|滑动|拖动|滑块|验证|captcha| puzzle/i.test(uiDump);
      if (!hasPuzzle) {
        // 拼图已消失，验证通过
        return true;
      }

      const elems = findSliderElements(uiDump);

      if (elems.track) {
        const track = elems.track;
        const thumb = elems.thumb;
        const trackWidth = track.x2 - track.x1;
        const stepSize = Math.max(Math.floor(trackWidth / 8), 20);

        const thumbCenterX = Math.floor((thumb.bounds[0] + thumb.bounds[2]) / 2);
        const thumbCenterY = Math.floor((thumb.bounds[1] + thumb.bounds[3]) / 2);

        console.log('   拖动滑块 (' + i + '/' + maxAttempts + ')');
        console.log('     轨道: ' + track.x1 + '-' + track.x2 + ' y=' + track.y);

        // 从左到右逐步拖动
        if (i === 0) {
          // 第一次：拖到 1/4 位置
          console.log('     尝试拖动到 25%');
          await execAdb(['shell', 'input', 'swipe',
            String(thumbCenterX), String(thumbCenterY),
            String(track.x1 + Math.floor(trackWidth * 0.25)), String(track.y),
            '500'
          ], 5000);
        } else if (i === 1) {
          console.log('     尝试拖动到 50%');
          await execAdb(['shell', 'input', 'swipe',
            String(thumbCenterX), String(thumbCenterY),
            String(track.x1 + Math.floor(trackWidth * 0.50)), String(track.y),
            '500'
          ], 5000);
        } else if (i === 2) {
          console.log('     尝试拖动到 75%');
          await execAdb(['shell', 'input', 'swipe',
            String(thumbCenterX), String(thumbCenterY),
            String(track.x1 + Math.floor(trackWidth * 0.75)), String(track.y),
            '500'
          ], 5000);
        } else if (i === 3) {
          console.log('     尝试全拖到 95%');
          await execAdb(['shell', 'input', 'swipe',
            String(thumbCenterX), String(thumbCenterY),
            String(track.x1 + Math.floor(trackWidth * 0.95)), String(track.y),
            '600'
          ], 5000);
        } else if (i === 4) {
          console.log('     尝试缓慢拖动到 60%');
          await execAdb(['shell', 'input', 'swipe',
            String(thumbCenterX), String(thumbCenterY),
            String(track.x1 + Math.floor(trackWidth * 0.60)), String(track.y),
            '800'
          ], 5000);
        } else if (i === 5) {
          console.log('     尝试缓慢拖动到 40%');
          await execAdb(['shell', 'input', 'swipe',
            String(thumbCenterX), String(thumbCenterY),
            String(track.x1 + Math.floor(trackWidth * 0.40)), String(track.y),
            '800'
          ], 5000);
        } else {
          console.log('     尝试拖动到 ' + (i * 10 + 10) + '%');
          const pct = Math.min((i * 10 + 10) / 100, 1.0);
          await execAdb(['shell', 'input', 'swipe',
            String(thumbCenterX), String(thumbCenterY),
            String(track.x1 + Math.floor(trackWidth * pct)), String(track.y),
            '600'
          ], 5000);
        }

        await sleep(2000);
      } else {
        // 检测到拼图但找不到滑块元素
        console.log('   检测到拼图验证但找不到滑块，等待...');
        await sleep(2000);
      }

    } catch (e) {
      await sleep(1000);
    }
  }

  console.log('   滑块验证达到最大次数');
  return false;
}

/**
 * 截屏并保存到 screenshots/{run_id}/
 * @param {string} label - 截图标签
 */
async function captureScreen(label) {
  if (!doScreenshot) return null;
  try {
    const devicePath = '/sdcard/vtest_capture.png';
    await execAdb(['shell', 'screencap', '-p', devicePath], 5000);
    const base64 = await execAdb(['shell', 'cat', devicePath + ' | base64'], 10000);
    if (base64) {
      return screenshotHelper.saveScreenshot(base64, label);
    }
  } catch (e) { /* ignore */ }
  return null;
}

/**
 * 检测并关闭 Android 安装风险弹窗（支持多步骤、华为/小米/OPPO）
 *
 * 安全规则：
 *   1. 必须先确认是安装弹窗，才点击任何元素
 *   2. 检测到弹窗消失后，等待 2s 再继续（防跳转间隙误点）
 *   3. 只点击对话框内的按钮，绝不点击桌面/应用商店元素
 *   4. 弹窗2（安全提醒）必须先勾选 checkbox 再点按钮
 *
 * 华为 P50 Pocket 流程：
 *   弹窗1: "风险提示" → 点击"继续安装"按钮（等待过渡）
 *   弹窗2: "安全提醒" → 勾选"已了解此应用未经检测..."复选框 → 点击"继续安装"
 *   拼图3: "安全验证" → 尝试拖动滑块
 *
 * @param {number} maxAttempts - 最大尝试次数
 * @param {function} stopFlag - 外部停止信号函数
 */
async function dismissRiskDialog(maxAttempts, stopFlag) {
  maxAttempts = maxAttempts || 50;
  let lastUiTexts = '';

  function dumpUI() {
    return execAdb(['shell', 'uiautomator', 'dump', '/sdcard/ui_risk.xml'], 5000)
      .then(() => execAdb(['shell', 'cat', '/sdcard/ui_risk.xml'], 3000))
      .catch(() => '');
  }

  /**
   * 判断当前 UI 是否包含安装对话框
   * 只有确认是安装对话框，才允许点击操作
   */
  function isInstallDialog(texts) {
    const combined = texts.join('|');
    const dialogIndicators = /风险提示|安全提醒|继续安装|取消|取消安装|安装应用|packageinstaller|PackageInstaller/i;
    return dialogIndicators.test(combined);
  }

  /**
   * 判断是否是弹窗2（安全提醒，需要先勾 checkbox）
   */
  function isSecurityWarningDialog(texts) {
    return texts.some(t => t === '安全提醒');
  }

  /**
   * 判断当前 UI 是否是普通的桌面/启动器（非对话框）
   */
  function isLauncherScreen(texts) {
    const launcherHints = ['应用市场', '畅连', '主题', '钱包', '设置', '相机', '6月', '℃'];
    const matchCount = launcherHints.filter(h => texts.some(t => t.includes(h))).length;
    return matchCount >= 3;
  }

  // ─── 状态机 ──────────────────────────────────────────
  // IDLE → DIALOG1_RISK → DIALOG1_DISMISSED → WAITING → DIALOG2_SECURITY → DIALOG2_CHECKING → DIALOG2_READY → DIALOG2_DISMISSED → PUZZLE → DONE
  let state = 'IDLE';
  let clickCount = 0;

  for (let i = 0; i < maxAttempts; i++) {
    if (stopFlag && stopFlag()) return true;

    try {
      const uiDump = await dumpUI();
      if (!uiDump) { await sleep(1000); continue; }

      // ─── 提取所有节点（含 text、bounds、class、checkable、checked 等） ──
      // 华为 UI dump XML 属性顺序不固定，需要逐个提取属性值
      const allNodes = [];
      const anyNodeRe = /<node([^>]*?)\/?>/g;
      let nm;
      while ((nm = anyNodeRe.exec(uiDump)) !== null) {
        const attrs = nm[1];
        const textM  = /text="([^"]*)"/.exec(attrs) || ['', ''];
        const clsM   = /class="([^"]*)"/.exec(attrs) || ['', ''];
        const chkM   = /checkable="([^"]*)"/.exec(attrs) || ['', ''];
        const ckdM   = /checked="([^"]*)"/.exec(attrs) || ['', ''];
        const clkM   = /clickable="([^"]*)"/.exec(attrs) || ['', ''];
        const bndM   = /bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(attrs);
        if (!bndM) continue;
        const node = {
          text: textM[1],
          cls: clsM[1],
          checkable: chkM[1],
          checked: ckdM[1],
          clickable: clkM[1],
          bounds: [parseInt(bndM[1]), parseInt(bndM[2]), parseInt(bndM[3]), parseInt(bndM[4])]
        };
        // 标记小尺寸图标节点（可能是 checkbox 图标）
        const w = node.bounds[2] - node.bounds[0];
        const h = node.bounds[3] - node.bounds[1];
        if (node.text === '' && w > 10 && w < 100 && h > 10 && h < 100) {
          node.isIcon = true;
        }
        allNodes.push(node);
      }

      const textNodes = allNodes.filter(n => n.text.trim() !== '');
      const uniqueTexts = [...new Set(textNodes.map(n => n.text))];

      if (uniqueTexts.length > 0 && JSON.stringify(uniqueTexts) !== lastUiTexts) {
        console.log('   当前屏幕元素: ' + uniqueTexts.slice(0, 8).join(' | '));
        logToFile('DIALOG', '屏幕元素: ' + uniqueTexts.slice(0, 10).join(' | ') + ' | state=' + state);
        lastUiTexts = JSON.stringify(uniqueTexts);
        // 将完整 UI dump 写入日志（增加到前 5000 字符以捕获更多 checkbox 信息）
        logToFile('DUMP', uiDump.substring(0, 5000));
      }

      // ─── 状态: 等待下一个弹窗出现 ──
      if (state === 'WAITING' || state === 'DIALOG1_DISMISSED' || state === 'DIALOG2_DISMISSED') {
        console.log('   等待下一弹窗... (state=' + state + ')');
        await sleep(3000);

        if (!isInstallDialog(uniqueTexts)) {
          // 弹窗消失了 → 可能是安装成功/失败
          // 再等2秒确认真的消失了
          await sleep(2000);
          const recheck = await dumpUI();
          if (!recheck) { state = 'DONE'; break; }
          const recheckTexts = [];
          const rtRe = /<node[^>]*?text="([^"]+)"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g;
          let rm;
          while ((rm = rtRe.exec(recheck)) !== null) { if (rm[1].trim()) recheckTexts.push(rm[1].trim()); }
          if (!isInstallDialog(recheckTexts)) {
            console.log('   弹窗已消失，可能安装成功或拼图验证出现');
            // 检查是否有拼图验证
            const hasPuzzle = /拼图|滑动|拖动|滑块|验证|captcha/i.test(recheck);
            if (hasPuzzle) {
              console.log('   检测到拼图验证，自动尝试...');
              await solveSliderPuzzle(15);
            }
            state = 'DONE';
            break;
          }
          // 弹窗还在，继续处理
        }
        // 重新评估状态
        if (isSecurityWarningDialog(uniqueTexts)) {
          state = 'DIALOG2_SECURITY';
          console.log('   检测到安全提醒弹窗（弹窗2）');
          captureScreen('dialog2-security-warning').catch(() => {});
        } else if (isInstallDialog(uniqueTexts)) {
          state = 'DIALOG1_RISK';
          console.log('   检测到安装弹窗');
        }
        continue;
      }

      // ─── 安全检查：不是安装弹窗 → 跳过 ──
      if (!isInstallDialog(uniqueTexts)) {
        await sleep(2000);
        continue;
      }

      // ─── 限制总点击次数 ──
      if (clickCount >= 20) {
        console.log('   点击次数已达上限（20次）');
        break;
      }

      // ─── 状态识别 ────────────────────────────────────
      if (isSecurityWarningDialog(uniqueTexts)) {
        if (state === 'IDLE' || state === 'DIALOG1_RISK') {
          // 直接跳到弹窗2（可能弹窗1已经自动过了）
          state = 'DIALOG2_SECURITY';
        }
      } else if (uniqueTexts.some(t => t === '风险提示')) {
        state = 'DIALOG1_RISK';
      } else {
        // 通用安装弹窗
        state = 'DIALOG1_RISK';
      }

      // ─── 弹窗1: 风险提示 → 直接点击"继续安装" ───────
      if (state === 'DIALOG1_RISK') {
        for (const node of textNodes) {
          if (node.text.length > 10 || node.text.length < 2) continue;
          const t = node.text;
          if (t === '继续安装' || (t.includes('继续') && t.length <= 6)) {
            const cx = Math.floor((node.bounds[0] + node.bounds[2]) / 2);
            const cy = Math.floor((node.bounds[1] + node.bounds[3]) / 2);
            console.log('   [弹窗1] 点击: ' + node.text);
            logToFile('CLICK', '[弹窗1] 点击: ' + node.text + ' at [' + cx + ',' + cy + ']');
            await execAdb(['shell', 'input', 'tap', String(cx), String(cy)], 3000);
            clickCount++;
            state = 'DIALOG1_DISMISSED';
            break;
          }
        }
        if (state === 'DIALOG1_DISMISSED') continue;

        // 没找到按钮，等待
        await sleep(2000);
        continue;
      }

      // ─── 弹窗2: 安全提醒 → 必须先勾选 checkbox ───────
      if (state === 'DIALOG2_SECURITY' || state === 'DIALOG2_CHECKING') {

        // === 阶段1: 检测并勾选 checkbox ===

        // 方法1: 标准 Android checkbox (checkable="true", checked="false")
        let checkboxChecked = false;
        const stdCheckboxNodes = allNodes.filter(n => n.checkable === 'true' && n.checked === 'false');
        if (stdCheckboxNodes.length > 0) {
          for (const cb of stdCheckboxNodes) {
            const cx = Math.floor((cb.bounds[0] + cb.bounds[2]) / 2);
            const cy = Math.floor((cb.bounds[1] + cb.bounds[3]) / 2);
            console.log('   [弹窗2] 勾选标准checkbox at [' + cx + ',' + cy + ']');
            logToFile('CLICK', '[弹窗2] 勾选标准checkbox at [' + cx + ',' + cy + ']');
            await execAdb(['shell', 'input', 'tap', String(cx), String(cy)], 3000);
            clickCount++;
            checkboxChecked = true;
            await sleep(1500); // 勾选后等待 1.5 秒让界面更新
          }
        }

        // 方法2: 华为自定义 checkbox — 找 checkbox 旁的说明文字
        //   华为 checkbox 说明文字通常是: "已了解此应用未经检测..." 或类似
        //   关键特征: 含"已了解" / "已阅读" / "已同意" 等开头，或含 "未经检测" 关键词
        //   策略: 点击文字节点左侧偏移区域（checkbox 在文字左边）
        if (!checkboxChecked) {
          // 第一优先: 找含"已了解/已阅读/已同意/已确认"的短文字（checkbox 旁的勾选说明）
          const cbAckKeywords = /^已了解|^已阅读|^已同意|^已确认|^已.*了解|^已.*阅读|^已.*同意/i;
          const ackTextNodes = textNodes.filter(n =>
            n.text.length >= 5 && cbAckKeywords.test(n.text)
          );
          if (ackTextNodes.length > 0) {
            for (const ctNode of ackTextNodes) {
              const cbX = ctNode.bounds[0] - 40;
              const cbY = Math.floor((ctNode.bounds[1] + ctNode.bounds[3]) / 2);
              const tapX = Math.max(cbX, 20);
              console.log('   [弹窗2] 点击"已了解"checkbox左侧: 文字="' + ctNode.text.substring(0, 30) + '" tap=[' + tapX + ',' + cbY + ']');
              logToFile('CLICK', '[弹窗2] 点击"已了解"checkbox at [' + tapX + ',' + cbY + '] text="' + ctNode.text.substring(0, 40) + '"');
              await execAdb(['shell', 'input', 'tap', String(tapX), String(cbY)], 3000);
              clickCount++;
              checkboxChecked = true;
              await sleep(1500);
              break;
            }
          }

          // 第二优先: 找含"了解/检测/管控/未经"等关键词的说明文字节点
          //   但排除大段说明文字（如"为提供更安全的应用服务..."），只匹配较短的勾选说明文字
          if (!checkboxChecked) {
            const cbKeywords = /了解|检测|管控|未经|此应用|已.*了解|安全.*检测|trust|risk/i;
            const checkboxTextNodes = textNodes.filter(n =>
              n.text.length >= 10 && n.text.length <= 80 && cbKeywords.test(n.text) &&
              !/^风险提示$|^安全提醒$/.test(n.text) &&
              // 排除大段说明文字（>80字的是段落而非checkbox旁说明）
              !/^为提供|^建议/.test(n.text) // 排除"为提供更安全..."和"建议优先安装..."
            );

            if (checkboxTextNodes.length > 0) {
              for (const ctNode of checkboxTextNodes) {
                const cbX = ctNode.bounds[0] - 40;
                const cbY = Math.floor((ctNode.bounds[1] + ctNode.bounds[3]) / 2);
                const tapX = Math.max(cbX, 20);
                console.log('   [弹窗2] 点击checkbox文字左侧: 文字="' + ctNode.text.substring(0, 30) + '" tap=[' + tapX + ',' + cbY + ']');
                logToFile('CLICK', '[弹窗2] checkbox文字左偏移 at [' + tapX + ',' + cbY + '] text="' + ctNode.text.substring(0, 40) + '"');
                await execAdb(['shell', 'input', 'tap', String(tapX), String(cbY)], 3000);
                clickCount++;
                checkboxChecked = true;
                await sleep(1500);
                break;
              }
            }
          }

          // 第三优先: 华为 checkbox 可能不在文字左侧而是在文字左侧再偏左一些
          //   尝试更大偏移范围：文字左边缘偏移 60~80px
          if (!checkboxChecked) {
            const cbKeywords3 = /了解|检测|管控|未经/i;
            const cbTextNode3 = textNodes.find(n =>
              n.text.length >= 10 && n.text.length <= 80 && cbKeywords3.test(n.text) &&
              !/^风险提示$|^安全提醒$|^为提供|^建议/.test(n.text)
            );
            if (cbTextNode3) {
              // 尝试多个偏移位置 [-80, -60, -40, -20, 0]
              const offsets = [-80, -60, -40, -20, 0];
              for (const off of offsets) {
                const tryX = Math.max(cbTextNode3.bounds[0] + off, 20);
                const tryY = Math.floor((cbTextNode3.bounds[1] + cbTextNode3.bounds[3]) / 2);
                console.log('   [弹窗2] 多偏移尝试: offset=' + off + ' at [' + tryX + ',' + tryY + ']');
                logToFile('CLICK', '[弹窗2] 多偏移checkbox offset=' + off + ' at [' + tryX + ',' + tryY + ']');
                await execAdb(['shell', 'input', 'tap', String(tryX), String(tryY)], 3000);
                clickCount++;
                await sleep(800);
              }
              checkboxChecked = true; // 标记为已尝试（即使不确定是否勾选成功）
              await sleep(1500);
            }
          }
        } // 关闭方法2的 if(!checkboxChecked)

        // 方法4: 找 checkbox 文字节点左侧的小 ImageView 图标（华为 checkbox 可能是 ImageView）
        if (!checkboxChecked) {
          const cbKeywords4 = /了解|检测|管控|未经/i;
          const cbTextNode4 = textNodes.find(n =>
            n.text.length >= 5 && n.text.length <= 80 && cbKeywords4.test(n.text) &&
            !/^风险提示$|^安全提醒$|^为提供|^建议/.test(n.text)
          );
          if (cbTextNode4) {
            const textCenterY = Math.floor((cbTextNode4.bounds[1] + cbTextNode4.bounds[3]) / 2);
            // 在文字左侧区域找小图标节点（垂直距离 < 50px，水平在文字左边缘的左侧）
            const nearbyIcons = allNodes.filter(n =>
              n.isIcon &&
              Math.abs(Math.floor((n.bounds[1] + n.bounds[3]) / 2) - textCenterY) < 60 &&
              n.bounds[2] < cbTextNode4.bounds[0] + 20 // 图标在文字左边缘附近
            );
            if (nearbyIcons.length > 0) {
              // 点击最近的图标
              const icon = nearbyIcons[0];
              const cx = Math.floor((icon.bounds[0] + icon.bounds[2]) / 2);
              const cy = Math.floor((icon.bounds[1] + icon.bounds[3]) / 2);
              console.log('   [弹窗2] 点击checkbox图标: class=' + icon.cls + ' at [' + cx + ',' + cy + ']');
              logToFile('CLICK', '[弹窗2] 点击checkbox图标 at [' + cx + ',' + cy + ']');
              await execAdb(['shell', 'input', 'tap', String(cx), String(cy)], 3000);
              clickCount++;
              checkboxChecked = true;
              await sleep(1500);
            }
          }
        }

        // === 阶段2: 验证 checkbox 是否已勾选 ===
        if (checkboxChecked) {
          // 重新 dump UI 验证勾选状态
          const verifyDump = await dumpUI();
          if (verifyDump) {
            // 检查 checkbox 文字是否消失了（勾选后华为可能隐藏 checkbox 说明）
            const verifyTexts = [];
            const vtRe = /<node[^>]*?text="([^"]+)"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g;
            let vm;
            while ((vm = vtRe.exec(verifyDump)) !== null) { if (vm[1].trim()) verifyTexts.push(vm[1].trim()); }

            const stillHasCheckboxText = verifyTexts.some(t =>
              /了解|检测|管控|未经|此应用|已.*了解/i.test(t) && t.length >= 10 &&
              !/^风险提示$|^安全提醒$/.test(t)
            );

            // 也检查标准 checkbox 是否变为 checked="true"
            const nowChecked = /checkable="true"\s+checked="true"/.test(verifyDump);

            if (nowChecked || !stillHasCheckboxText) {
              console.log('   [弹窗2] checkbox 已勾选 ✓ (checked=' + nowChecked + ', checkboxText消失=' + !stillHasCheckboxText + ')');
              logToFile('DIALOG', 'checkbox勾选验证通过: checked=' + nowChecked);
              state = 'DIALOG2_READY';
              captureScreen('dialog2-checkbox-verified').catch(() => {});
            } else {
              // checkbox 可能还没勾上，再尝试多点几次
              console.log('   [弹窗2] checkbox 可能未勾选，多位置重试...');
              logToFile('DIALOG', 'checkbox勾选验证失败，多位置重试');
              state = 'DIALOG2_CHECKING';
              // 找到checkbox旁的文字节点，用更宽的偏移范围尝试
              const cbTextNodeRetry = textNodes.find(n =>
                n.text.length >= 5 && n.text.length <= 80 && /了解|检测|管控|未经|已/i.test(n.text) &&
                !/^风险提示$|^安全提醒$|^为提供|^建议/.test(n.text)
              );
              if (cbTextNodeRetry) {
                // 尝试多个偏移位置：文字左边缘偏移 -80 到 0
                const offsets = [-80, -60, -40, -20, 0];
                for (const off of offsets) {
                  const tryX = Math.max(cbTextNodeRetry.bounds[0] + off, 20);
                  const tryY = Math.floor((cbTextNodeRetry.bounds[1] + cbTextNodeRetry.bounds[3]) / 2);
                  console.log('   [弹窗2] 重试checkbox: offset=' + off + ' at [' + tryX + ',' + tryY + ']');
                  logToFile('CLICK', '[弹窗2] 重试checkbox offset=' + off + ' at [' + tryX + ',' + tryY + ']');
                  await execAdb(['shell', 'input', 'tap', String(tryX), String(tryY)], 3000);
                  clickCount++;
                  await sleep(1000);
                }
              }
              // 等待后再重新验证
              await sleep(2000);
              continue;
            }
          }
        }

        // === 阶段3: checkbox 已勾选，点击"继续安装"按钮 ===
        if (state === 'DIALOG2_READY') {
          // 重新获取最新 UI dump（按钮位置可能变化）
          const latestDump = await dumpUI();
          if (!latestDump) { await sleep(1000); continue; }

          const latestTextNodes = [];
          const ltRe = /<node[^>]*?text="([^"]+)"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g;
          let lm;
          while ((lm = ltRe.exec(latestDump)) !== null) {
            const t = lm[1].trim();
            if (t) latestTextNodes.push({ text: t, bounds: [parseInt(lm[2]), parseInt(lm[3]), parseInt(lm[4]), parseInt(lm[5])] });
          }

          let foundBtn = false;
          for (const node of latestTextNodes) {
            if (node.text.length > 10 || node.text.length < 2) continue;
            if (node.text === '继续安装' || (node.text.includes('继续') && node.text.length <= 6)) {
              const cx = Math.floor((node.bounds[0] + node.bounds[2]) / 2);
              const cy = Math.floor((node.bounds[1] + node.bounds[3]) / 2);
              console.log('   [弹窗2] 点击: ' + node.text);
              logToFile('CLICK', '[弹窗2] 点击按钮: ' + node.text + ' at [' + cx + ',' + cy + ']');
              await execAdb(['shell', 'input', 'tap', String(cx), String(cy)], 3000);
              clickCount++;
              foundBtn = true;
              state = 'DIALOG2_DISMISSED';
              captureScreen('dialog2-after-continue-click').catch(() => {});
              break;
            }
          }

          if (foundBtn) continue;

          // 没找到按钮，可能 checkbox 勾选后按钮位置变了，等待
          console.log('   [弹窗2] checkbox已勾但没找到按钮，等待...');
          await sleep(2000);
          continue;
        }

        // === 阶段1.5: 没找到 checkbox 也没勾选 → 等一下再看 ===
        if (!checkboxChecked && state === 'DIALOG2_SECURITY') {
          console.log('   [弹窗2] 未找到checkbox，等待界面加载...');
          await sleep(2500);
          state = 'DIALOG2_CHECKING'; // 下次再尝试
          continue;
        }

        // 如果处于 CHECKING 状态且已尽力勾选，直接尝试点按钮（兜底）
        if (state === 'DIALOG2_CHECKING') {
          console.log('   [弹窗2] 多次尝试勾选checkbox，现在直接点击继续安装...');
          for (const node of textNodes) {
            if (node.text === '继续安装' || (node.text.includes('继续') && node.text.length <= 6)) {
              const cx = Math.floor((node.bounds[0] + node.bounds[2]) / 2);
              const cy = Math.floor((node.bounds[1] + node.bounds[3]) / 2);
              console.log('   [弹窗2] 兜底点击: ' + node.text);
              logToFile('CLICK', '[弹窗2] 兜底点击: ' + node.text + ' at [' + cx + ',' + cy + ']');
              await execAdb(['shell', 'input', 'tap', String(cx), String(cy)], 3000);
              clickCount++;
              state = 'DIALOG2_DISMISSED';
              break;
            }
          }
          if (state === 'DIALOG2_DISMISSED') continue;
          await sleep(2000);
          continue;
        }
      }

    } catch (e) {
      console.error('   弹窗处理异常: ' + e.message);
      logToFile('ERROR', '弹窗处理异常: ' + e.message);
      await sleep(1000);
    }

    // 每 3 轮检查拼图验证
    if (i > 0 && i % 3 === 0) {
      await checkAndSolveSlider().catch(function() {});
    }
  }

  console.log('   安装弹窗处理结束 (state=' + state + ', clicks=' + clickCount + ')');
  return true;
}

/**
 * 检测拼图验证并尝试自动拖动滑块通过
 */
async function checkAndSolveSlider() {
  const uiDump = await (async function() {
    return await execAdb(['shell', 'uiautomator', 'dump', '/sdcard/ui_slider.xml'], 5000)
      .then(() => execAdb(['shell', 'cat', '/sdcard/ui_slider.xml'], 3000))
      .catch(() => '');
  })();

  if (!uiDump) return false;
  const hasPuzzle = /拼图|滑动|拖动|滑块|验证|captcha| puzzle/i.test(uiDump);
  if (hasPuzzle) {
    console.log('   检测到拼图验证，自动尝试拖动...');
    return await solveSliderPuzzle(10);
  }
  return false;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function log(emoji, msg) { console.log('  ' + emoji + '  ' + msg); }

/**
 * 处理安装后界面（华为帐号登录 / 完成按钮 / 打开按钮）
 *
 * 华为 P50 Pocket 完整安装流程:
 *   [弹窗1] 风险提示 → [弹窗2] 安全提醒+checkbox → [拼图] 滑块验证
 *   → [华为帐号登录] 输入密码 → [安装完成] "完成"按钮
 *
 * @param {Object} options - { waitForUserTimeout, deviceProfile }
 * @returns {Promise<boolean>} true=安装完成可以启动应用, false=安装可能失败
 */
async function handlePostInstallScreens(options) {
  const timeout = options?.waitForUserTimeout || 120000;
  const profile = options?.deviceProfile?.profile || {};
  const dialogFlow = profile.dialogFlow || {};
  const installKeywords = dialogFlow.stageKeywords?.install_complete || ['完成', '打开', 'Done'];
  const loginKeywords = dialogFlow.stageKeywords?.huawei_login ||
    ['华为帐号', '华为账号', '密码', '登录', '输入密码', 'HUAWEI ID', '帐号密码', '安全验证'];

  const startTime = Date.now();

  function dumpUI() {
    return execAdb(['shell', 'uiautomator', 'dump', '/sdcard/ui_postinstall.xml'], 5000)
      .then(() => execAdb(['shell', 'cat', '/sdcard/ui_postinstall.xml'], 3000))
      .catch(() => '');
  }

  log('   ', '检查安装后界面（登录/完成按钮）...');

  // ─── 快速扫描：优先检测"完成/打开"按钮（最多3轮），不长时间等待 ──
  for (let i = 0; i < 8; i++) {
    const remaining = timeout - (Date.now() - startTime);
    if (remaining <= 0) {
      log('   ', '安装后处理超时');
      break;
    }

    const uiDump = await dumpUI();
    if (!uiDump) { await sleep(1000); continue; }

    // 提取文本节点
    const textNodes = [];
    const textRe = /<node[^>]*?text="([^"]+)"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g;
    let tm;
    while ((tm = textRe.exec(uiDump)) !== null) {
      const t = tm[1].trim();
      if (t) textNodes.push({
        text: t,
        bounds: [parseInt(tm[2]), parseInt(tm[3]), parseInt(tm[4]), parseInt(tm[5])]
      });
    }
    const uniqueTexts = [...new Set(textNodes.map(n => n.text))];

// ── 快速检测：桌面特征（无安装相关界面）→ 立即退出 ──
      const launcherHints = ['应用市场', '主题', '钱包', '畅连', '搜索', '屏幕录制',
        '天气预报', '服务', '花粉俱乐部', '智慧生活'];
      const desktopMatchCount = launcherHints.filter(h => uniqueTexts.some(t => t.includes(h))).length;
    if (desktopMatchCount >= 2) {
      log('   ', '检测到桌面界面（' + desktopMatchCount + '个桌面特征），安装已完成');
      logToFile('INFO', '安装后处理: 检测到桌面，立即退出');
      await sleep(1000);
      return true;
    }

    // ── 检测华为帐号登录界面 ──
    const isLoginScreen = loginKeywords.some(kw =>
      uniqueTexts.some(t => t.includes(kw))
    );

    if (isLoginScreen) {
      console.log('\n  ╔══════════════════════════════════════════════╗');
      console.log('  ║  检测到华为帐号登录界面                      ║');
      console.log('  ╚══════════════════════════════════════════════╝\n');
      logToFile('DIALOG', '检测到华为帐号登录界面');

      // ── 尝试自动填充密码（从 .env 读取） ──
      const hwPw = process.env.pw || process.env.HUAWEI_ACCOUNT_PASSWORD || '';
      if (hwPw) {
        console.log('   [登录] 从 .env 读取到华为密码，自动填充...');
        logToFile('DIALOG', '从 .env 读取到华为密码，自动填充');

        try {
          // 查找密码输入框的位置（多策略）
          const pwDump = await dumpUI();
          if (pwDump) {
            // 策略1: 找 EditText 或 Password 类名节点
            let pwNode = null;
            let pwRe = /<node[^>]*?class="[^"]*(?:EditText|Password|HwEditText|HwPassword|InputView)[^"]*"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*?\/?>/i;
            let pwM = pwRe.exec(pwDump);
            if (pwM) pwNode = pwM;

            // 策略2: 找 password="true" 属性的节点
            if (!pwNode) {
              pwRe = /<node[^>]*?(?:class="[^"]*?password[^"]*?"|password="true")[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*?\/?>/i;
              pwM = pwRe.exec(pwDump);
              if (pwM) pwNode = pwM;
            }

            // 策略3: 找 resource-id 含 password/pwd/input 的节点
            if (!pwNode) {
              pwRe = /<node[^>]*?resource-id="[^"]*(?:password|pwd|input|edit)[^"]*"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*?\/?>/i;
              pwM = pwRe.exec(pwDump);
              if (pwM) pwNode = pwM;
            }

            // 策略4: 找 focusable="true" 的节点（华为登录弹窗中唯一焦点节点就是密码输入框）
            if (!pwNode) {
              pwRe = /<node[^>]*?focusable="true"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*?\/?>/i;
              pwM = pwRe.exec(pwDump);
              if (pwM) pwNode = pwM;
            }

            // 策略5: 找 hwid 包内的任何 clickable/focusable 节点（兜底）
            if (!pwNode) {
              pwRe = /<node[^>]*?class="[^"]*EditText[^"]*"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*?\/?>/i;
              pwM = pwRe.exec(pwDump);
            }

            if (pwNode) {
              const pwCx = Math.floor((parseInt(pwNode[1]) + parseInt(pwNode[3])) / 2);
              const pwCy = Math.floor((parseInt(pwNode[2]) + parseInt(pwNode[4])) / 2);
              logToFile('DIALOG', '找到密码输入框: [' + pwCx + ',' + pwCy + '] bounds=[' +
                pwNode[1] + ',' + pwNode[2] + ',' + pwNode[3] + ',' + pwNode[4] + ']');

              // 点中密码输入框
              await execAdb(['shell', 'input', 'tap', String(pwCx), String(pwCy)], 2000);
              await sleep(1000);

              // 确保输入框聚焦：先清空（长按全选→删除）
              await execAdb(['shell', 'input', 'keyevent', 'KEYCODE_MOVE_END'], 1000);
              await sleep(300);
              // 如果是已有内容，先清空
              for (let ci = 0; ci < 30; ci++) {
                await execAdb(['shell', 'input', 'keyevent', 'KEYCODE_DEL'], 200);
              }

              // 输入密码（ADB input text 支持大部分字符）
              // 密码中的特殊字符需要处理
              const safePw = hwPw
                .replace(/ /g, '%s')    // 空格 → %s
                .replace(/"/g, '\\"');   // 双引号转义
              await execAdb(['shell', 'input', 'text', safePw], 5000);
              logToFile('DIALOG', '密码已自动输入');

              // 查找并点击"确定"/"登录"按钮
              const loginBtnRe = /<node[^>]*?text="(?:确定|登录|下一步|确认)"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*?\/?>/i;
              const btnM = loginBtnRe.exec(pwDump);
              if (btnM) {
                const btnCx = Math.floor((parseInt(btnM[2]) + parseInt(btnM[4])) / 2);
                const btnCy = Math.floor((parseInt(btnM[3]) + parseInt(btnM[5])) / 2);
                await execAdb(['shell', 'input', 'tap', String(btnCx), String(btnCy)], 3000);
                logToFile('DIALOG', '已点击登录按钮');
                console.log('   [登录] ✓ 密码已输入并点击登录');
              } else {
                // 没找到确定按钮 → 按回车
                await execAdb(['shell', 'input', 'keyevent', 'KEYCODE_ENTER'], 3000);
                logToFile('DIALOG', '按回车确认登录');
                console.log('   [登录] ✓ 密码已输入（回车确认）');
              }
              captureScreen('huawei-login-autofilled').catch(() => {});
              await sleep(3000);
              continue;
            } else {
              logToFile('DIALOG', '未找到密码输入框节点，5种策略均失败');
              console.log('   [登录] ⚠ 未找到密码输入框，回退到手动输入');
            }
          } else {
            logToFile('DIALOG', 'UI dump 为空');
            console.log('   [登录] ⚠ UI dump 为空，回退到手动输入');
          }
        } catch (e) {
          logToFile('DIALOG', '自动填充密码失败: ' + e.message);
          console.log('   [登录] 自动填充失败，等待手动输入');
        }
      } // end if (hwPw)

      if (!hwPw) {
        console.log('  ║  请在手机上输入你的华为帐号密码              ║');
        console.log('  ║  （也可在 .env 中配置 HUAWEI_ACCOUNT_PASSWORD）║');
        console.log('  ║  输入完成后点击"登录"继续安装               ║');
        console.log('  ║  等待超时: ' + Math.floor(remaining / 1000) + ' 秒              ║');
      }

      logToFile('DIALOG', '等待用户输入华为密码或自动填充完成');

      // 等待用户输入完成（登录界面消失）
      while (Date.now() - startTime < timeout) {
        await sleep(3000);
        const recheck = await dumpUI();
        if (!recheck) continue;
        const recheckTexts = [];
        const rcRe = /<node[^>]*?text="([^"]+)"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g;
        let rm;
        while ((rm = rcRe.exec(recheck)) !== null) { if (rm[1].trim()) recheckTexts.push(rm[1].trim()); }

        const stillLogin = loginKeywords.some(kw => recheckTexts.some(t => t.includes(kw)));
        if (!stillLogin) {
          console.log('  ║  ✓ 华为帐号登录完成，继续...                 ║\n');
          logToFile('DIALOG', '华为帐号登录完成，继续安装');
          captureScreen('huawei-login-done').catch(() => {});
          await sleep(3000); // 登录完成后等待安装开始
          break;
        }

        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        process.stdout.write('\r  等待华为帐号密码输入... ' + elapsed + 's  ');
      }
      continue; // 进入下一轮扫描（找完成按钮）
    }

    // ── 检测"完成"/"打开"按钮 ──
    const isCompleteScreen = installKeywords.some(kw =>
      uniqueTexts.some(t => t === kw) // 精确匹配
    );

    if (isCompleteScreen) {
      // 优先点击"打开"（直接启动应用），其次"完成"
      let btnClicked = false;
      for (const kw of ['打开', '完成', '完成安装', 'Done']) {
        if (btnClicked) break;
        for (const node of textNodes) {
          const t = node.text.trim();
          if (t !== kw) continue;
          const cx = Math.floor((node.bounds[0] + node.bounds[2]) / 2);
          const cy = Math.floor((node.bounds[1] + node.bounds[3]) / 2);
          console.log('   [安装完成] 点击: ' + t);
          logToFile('CLICK', '[安装完成] 点击: ' + t + ' at [' + cx + ',' + cy + ']');
          await execAdb(['shell', 'input', 'tap', String(cx), String(cy)], 3000);
          btnClicked = true;
          captureScreen('install-complete').catch(() => {});

          // 如果点了"打开"，应用已启动，不用再执行启动步骤
          if (t === '打开') {
            log('   ', '应用已通过"打开"按钮直接启动');
            return 'launched';  // 特殊返回，标记应用已启动
          }
          break;
        }
      }

      if (btnClicked) {
        log('   ', '安装完成按钮已点击');
        logToFile('INFO', '安装完成按钮已点击');
        await sleep(2000);
        return true;
      }
    }

    // ── 检测安装是否还在进行中的界面 ──
    const installingTexts = ['正在安装', '安装中', 'Installing', '请稍候'];
    const isInstalling = installingTexts.some(t =>
      uniqueTexts.some(s => s.includes(t))
    );

    if (isInstalling) {
      console.log('   安装进行中，等待...');
      await sleep(3000);
      continue;
    }

    // ── 检测安装失败界面 ──
    const failTexts = ['安装失败', '安装未成功', 'INSTALL_FAILED', '解析错误', '应用未安装'];
    const isFailed = failTexts.some(t => uniqueTexts.some(s => s.includes(t)));
    if (isFailed) {
      log('   ', '检测到安装失败界面');
      logToFile('ERROR', '安装失败界面: ' + uniqueTexts.join(' | '));
      captureScreen('install-failed').catch(() => {});
      return false;
    }

    // ── 检测是否已经在桌面（无安装相关界面）→ 立即退出 ──
    const installRelated = ['安装', 'install', 'packageinstaller', 'PackageInstaller',
      '完成', '打开', '华为帐号', '华为账号', '密码', '安装应用'];
    const hasInstallRelated = installRelated.some(t => uniqueTexts.some(s => s.includes(t)));
    if (!hasInstallRelated && i > 0) {
      // 第2轮起没有安装相关界面即退出
      log('   ', '安装相关界面已消失，返回桌面');
      await sleep(1000);
      return true;
    }

    await sleep(1000);
  }

  return true;
}

/**
 * 从 APK 中提取应用显示名（label）
 * 优先用 PC 端 aapt，其次用 adb shell pm 间接获取
 *
 * @param {string} apkPath - APK 文件路径
 * @returns {Promise<string>} 应用显示名，失败返回空字符串
 */
async function extractAppLabel(apkPath) {
  // 方式1: 尝试 PC 端 aapt（Android SDK build-tools）
  const aaptPaths = [
    'D:/Android/Sdk/build-tools/34.0.0/aapt.exe',
    'D:/Android/Sdk/build-tools/33.0.0/aapt.exe',
    'C:/Users/Peter/AppData/Local/Android/Sdk/build-tools/34.0.0/aapt.exe'
  ];
  for (const aaptPath of aaptPaths) {
    try {
      const { spawnSync } = require('child_process');
      const result = spawnSync(aaptPath, ['dump', 'badging', apkPath], { timeout: 10000 });
      if (result.status === 0) {
        const output = result.stdout.toString();
        const labelRe = /^application-label(?:-[a-z]{2}(?:-[A-Z]{2})?)?:'([^']+)'$/m;
        const m = labelRe.exec(output);
        if (m) {
          const label = m[1].trim();
          logToFile('INFO', 'APK label: ' + label);
          return label;
        }
      }
    } catch (e) { /* try next path */ }
  }

  // 方式2: 通过设备端 ADB 查已安装应用 label（app已安装后可用）
  try {
    // 从 APK 文件名/包路径推断包名
    const apkBasename = path.basename(apkPath, '.apk');
    const pkgSegments = apkBasename.split(/[-_]/);
    // APK 文件名通常含包名：mi_print-com.mi.print-458-4.1.713-st
    const pkgCandidate = pkgSegments.find(s => s.split('.').length >= 3);
    const targetPkg = pkgCandidate || PACKAGE_NAME;

    if (targetPkg) {
      // 查已安装应用的 label
      const pmPath = await execAdb(['shell', 'pm', 'path', targetPkg], 5000).catch(() => '');
      if (pmPath && pmPath.includes('package:')) {
        // 用 aapt dump badging 远程查（Android 内置 aapt）
        const apkPathOnDevice = pmPath.replace('package:', '').trim();
        const badging = await execAdb(
          ['shell', 'aapt', 'dump', 'badging', apkPathOnDevice], 10000).catch(() => '');
        if (badging) {
          const labelRe2 = /^application-label(?:-[a-z]{2})?:\s?'([^']+)'/m;
          const m2 = labelRe2.exec(badging);
          if (m2) {
            const label = m2[1].trim();
            logToFile('INFO', 'APK label (device aapt): ' + label);
            return label;
          }
        }

        // 兜底: 用 pm list packages -f 查
        const pkgList = await execAdb(
          ['shell', 'pm', 'list', 'packages', '-f', targetPkg], 5000).catch(() => '');
        if (pkgList) {
          // package:/data/app/.../base.apk=com.xiaomi.print
          const pkgLine = pkgList.split('\n').find(l => l.includes(targetPkg));
          if (pkgLine) {
            const deviceApkPath = pkgLine.replace(/^package:/, '').split('=')[0];
            if (deviceApkPath) {
              const deviceBadging = await execAdb(
                ['shell', 'aapt', 'dump', 'badging', deviceApkPath], 10000).catch(() => '');
              if (deviceBadging) {
                const m3 = labelRe2.exec(deviceBadging);
                if (m3) {
                  const label = m3[1].trim();
                  logToFile('INFO', 'APK label (device aapt v2): ' + label);
                  return label;
                }
              }
            }
          }
        }
      }
    }
  } catch (e) { /* ignore device extraction errors */ }

  return '';
}

/**
 * 从包名推断可能的应用显示名
 * com.xiaomi.print → ['xiaomi', 'print', '小米打印'(用户提供)]
 * com.mi.print → ['mi', 'print']
 */
function getAppNameCandidates(packageName, userProvidedName) {
  const candidates = [];
  // 1. 用户提供的应用名（最高优先级）
  if (userProvidedName) {
    candidates.push(userProvidedName);
    // 也加拼音/拆分版本 — 但也有限度，避免过多垃圾
    if (userProvidedName.length > 2) {
      // 取最后2-4个字符（通常应用名核心部分）
      for (let len = 2; len <= Math.min(4, userProvidedName.length); len++) {
        candidates.push(userProvidedName.substring(userProvidedName.length - len));
      }
    }
  }
  // 2. 包名分段（取各段和组合）
  const segments = packageName.split('.');
  // 包名最后一段: com.xiaomi.print → 'print'
  if (segments.length > 0) {
    candidates.push(segments[segments.length - 1]);
  }
  // 包名倒数第二段: com.xiaomi.print → 'xiaomi'
  if (segments.length > 1) {
    candidates.push(segments[segments.length - 2]);
  }
  // 最后两段组合: com.xiaomi.print → 'xiaomiprint'
  if (segments.length >= 2) {
    candidates.push(segments[segments.length - 2] + segments[segments.length - 1]);
  }
  // 完整包名最后一段的大写变体（驼峰拆分）
  const lastSeg = segments[segments.length - 1];
  for (let i = 1; i < lastSeg.length; i++) {
    if (lastSeg[i] === lastSeg[i].toUpperCase()) {
      candidates.push(lastSeg.substring(i)); // Print → 'Print'
      break;
    }
  }

  return [...new Set(candidates.filter(c => c && c.length > 0))];
}

/**
 * 从 UI dump 文本中匹配应用名称
 * 支持中文名、英文名、包名多种匹配
 */
function findAppIconInTexts(texts, candidates) {
  for (const c of candidates) {
    const cLower = c.toLowerCase();
    // 精确匹配
    let match = texts.find(t => t === c || t === cLower);
    if (match) return match;
    // 包含匹配
    match = texts.find(t => {
      const tLower = t.toLowerCase();
      return tLower.includes(cLower) || cLower.includes(tLower);
    });
    if (match) return match;
  }
  // 兜底: 任意一个有意义的文本（≥2中文字符，或 ≥3英文字符）
  const chinaMatch = texts.find(t => {
    if (t.length < 2 || t.length > 12) return false;
    // 排除纯数字（如桌面温度 "27"）
    if (/^\d+$/.test(t)) return false;
    // 排除纯标点/符号
    if (/^[^\w\u4e00-\u9fff]+$/.test(t)) return false;
    // 排除日期格式（如"6月10日星期三"）
    if (/\d+月\d+日/.test(t)) return false;
    // 排除温度/单位格式（如"27℃"）
    if (/^\d+[℃°]/.test(t) || /[℃°]$/.test(t)) return false;
    // 排除常见桌面元素和系统应用
    const exclude = ['应用市场', '主题', '钱包', '设置', '相机', '畅连', '搜索',
      '屏幕录制', '计算器', '日历', '时钟', '天气', '音乐', '视频', '文件管理',
      '热点', '智慧生活', '花粉俱乐部', '小艺建议', '服务', '天气预报',
      '华为', '天际通', '会员中心', '阅读', '我的', '云空间', '运动健康',
      '华为运动健康'];
    if (exclude.some(e => t.includes(e))) return false;
    // 至少包含一个中文字符（识别真正的应用名）
    return /[\u4e00-\u9fff]/.test(t);
  });
  return chinaMatch || null;
}

/**
 * 启动已安装的应用（多策略）
 *
 * 策略链:
 *   1. dumpsys package 查主Activity → am start (最可靠)
 *   2. monkey -p (传统方式)
 *   3. 桌面滑屏搜索图标 (兜底 — 包名+应用名双匹配)
 *
 * @param {string} packageName - 包名
 * @param {string} appName - 应用显示名（如"小米打印"），可选
 * @returns {Promise<boolean>} 是否成功启动
 */
async function launchInstalledApp(packageName, appName) {
  console.log('\n  ─── 启动应用: ' + packageName + (appName ? ' (' + appName + ')' : '') + ' ───');

  // ─── 策略1: 查找主 Activity 并用 am start 启动 ─────
  try {
    log('   ', '策略1: 查找主Activity...');
    // 使用 dumpsys package 查询主 Activity
    const pkgInfo = await execAdb(['shell', 'dumpsys', 'package', packageName], 10000);

    // 模式: packageName/.Activity 或 packageName/Activity
    const escapedPkg = packageName.replace(/\./g, '\\.');
    const activityRe = new RegExp(escapedPkg + '/([\\w.]+)', 'g');
    const activities = [];
    let am;
    while ((am = activityRe.exec(pkgInfo)) !== null) {
      const act = am[1];
      if (!activities.includes(act)) activities.push(act);
    }

    if (activities.length > 0) {
      // 尝试每个找到的 activity
      for (const act of activities) {
        const fullName = packageName + '/' + (act.startsWith('.') ? act : '.' + act);
        log('   ', '尝试启动: ' + fullName);

        try {
          const result = await execAdb(['shell', 'am', 'start', '-n', fullName,
            '-a', 'android.intent.action.MAIN',
            '-c', 'android.intent.category.LAUNCHER'], 10000);
          if (result.includes('Error')) {
            log('   ', '  -> 启动失败: ' + result.substring(0, 60));
            continue;
          }
          log('   ', '  ✓ 应用已通过 am start 启动');
          logToFile('INFO', '应用启动成功: ' + fullName);
          return true;
        } catch (e) {
          log('   ', '  -> ' + e.message.substring(0, 60));
        }
      }
    } else {
      log('   ', '  未找到主Activity，尝试完整 Activity 列表...');
      // 兜底: 直接尝试 packageName/.MainActivity 等常见命名
      const commonActivities = [
        '.MainActivity',
        '.SplashActivity',
        '.Main',
        '.HomeActivity',
        '.LauncherActivity',
        '.WelcomeActivity',
        '.MainFragmentActivity'
      ];
      for (const suffix of commonActivities) {
        const fullName = packageName + suffix;
        try {
          const result = await execAdb(['shell', 'am', 'start', '-n', fullName,
            '-a', 'android.intent.action.MAIN',
            '-c', 'android.intent.category.LAUNCHER'], 5000);
          if (!result.includes('Error') && !result.includes('does not exist')) {
            log('   ', '  ✓ 应用已启动: ' + fullName);
            return true;
          }
        } catch (e) { /* next */ }
      }
    }
  } catch (e) {
    log('   ', '  策略1失败: ' + e.message);
  }

  // ─── 策略2: monkey 启动（传统方式） ────────────────
  try {
    log('   ', '策略2: monkey 启动...');
    await execAdb(['shell', 'monkey', '-p', packageName, '--pct-syskeys', '0', '1'], 15000);
    log('   ', '  ✓ monkey 启动成功');
    return true;
  } catch (e) {
    log('   ', '  策略2失败: ' + e.message);
  }

  // ─── 策略3: 桌面滑屏搜索 ────────────────────────────
  // 如果前面都失败了，回到桌面滑屏找应用图标
  try {
    log('   ', '策略3: 桌面滑屏搜索应用图标...');
    // 先回到桌面
    await execAdb(['shell', 'input', 'keyevent', 'KEYCODE_HOME'], 3000);
    await sleep(1500);

    // 截取当前桌面截图（保存在截图系统里）
    await captureScreen('launcher-before-swipe').catch(() => {});

    // 从左到右多次滑屏，每次截屏检查
    const screenWidth = 1080;
    const screenHeight = 1920;

    for (let swipe = 0; swipe < 5; swipe++) {
      // 滑屏到下一桌面页
      if (swipe > 0) {
        // 从右向左滑
        await execAdb(['shell', 'input', 'swipe',
          String(screenWidth - 50), String(screenHeight / 2),
          '50', String(screenHeight / 2),
          '300'
        ], 3000);
        await sleep(2000);
      }

      // dump UI 查找包名或应用名相关文字
      const uiXml = await execAdb(['shell', 'uiautomator', 'dump', '/sdcard/ui_launcher.xml'], 5000)
        .then(() => execAdb(['shell', 'cat', '/sdcard/ui_launcher.xml'], 3000))
        .catch(() => '');
      if (!uiXml) continue;

      // 查找所有图标文字
      const simpleRe = /text="([^"]{2,20})"/g;
      const texts = [];
      while ((im = simpleRe.exec(uiXml)) !== null) {
        if (im[1].trim()) texts.push(im[1].trim());
      }

      // ── 匹配应用名（包名 + 用户提供的名字 + APK label 三重匹配） ──
      const nameCandidates = getAppNameCandidates(packageName, appName);
      const matchingText = findAppIconInTexts(texts, nameCandidates);

      if (matchingText) {
        log('   ', '  ✓ 找到应用图标: "' + matchingText + '"');

        // 从 UI dump 中找到该文字的 bounds
        const boundsRe = new RegExp(
          'text="' + matchingText.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&') +
          '"[^>]*?bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"', 'i');
        const bm = boundsRe.exec(uiXml);
        if (bm) {
          const cx = Math.floor((parseInt(bm[1]) + parseInt(bm[3])) / 2);
          const cy = Math.floor((parseInt(bm[2]) + parseInt(bm[4])) / 2);
          await execAdb(['shell', 'input', 'tap', String(cx), String(cy)], 3000);
          await sleep(2500);

          // ── 验证：点击后是否进入了目标应用 ──
          const verified = await verifyLaunchedApp(packageName);
          if (verified) {
            log('   ', '  ✓ 已点击桌面图标启动应用（验证通过）');
            await captureScreen('launcher-icon-tapped').catch(() => {});
            return true;
          } else {
            log('   ', '  ✗ 点击 "' + matchingText + '" 后未进入目标应用，继续搜索...');
            logToFile('INFO', '桌面图标假阳性: "' + matchingText + '" 不是 ' + packageName);
          }
        }
      }

      // 截屏保存（用于调试）
      await captureScreen('launcher-page-' + swipe).catch(() => {});
    }

    log('   ', '  桌面滑屏未找到应用图标');
  } catch (e) {
    log('   ', '  策略3失败: ' + e.message);
  }

  log('   ', '所有启动策略均失败');
  return false;
}

/**
 * 验证是否成功启动了目标应用
 * 检查 mCurrentFocus 是否包含目标包名
 */
async function verifyLaunchedApp(packageName) {
  try {
    const focus = await execAdb(['shell', 'dumpsys', 'window', '|', 'grep', 'mCurrentFocus'], 5000);
    if (focus && focus.includes(packageName)) {
      return true;
    }
    return false;
  } catch (e) {
    return false;  // 无法确认 → 保守返回 false
  }
}

// ─── 主流程 ─────────────────────────────────────────────
async function runExploration() {
  console.log('\n═══════════════════════════════════════════');
  console.log('  VTest AI 探索引擎 v2.0 — 真机测试');
  console.log('═══════════════════════════════════════════\n');

  // DeviceProfile — 全局持有
  let deviceProfile = null;

  const report = {
    packageName: PACKAGE_NAME,
    deviceModel: '',
    deviceBrand: '',
    androidVersion: '',
    runId: RUN_ID,
    startTime: new Date().toISOString(),
    endTime: '',
    duration: 0,
    maxDepth: MAX_DEPTH,
    totalSteps: 0,
    paths: [],
    activities: [],
    errors: [],
    screenshots: doScreenshot ? screenshotHelper.getScreenshotDir() : null,
    appLaunchedBy: ''
  };

  const startTime = Date.now();

  // Step 0: 验证 APK
  log('1/6', '验证 APK: ' + APK_PATH);
  if (!fs.existsSync(APK_PATH)) {
    console.error('\n  APK 文件不存在: ' + APK_PATH);
    process.exit(1);
  }
  const stats = fs.statSync(APK_PATH);
  log('   ', 'APK 大小: ' + (stats.size / 1024 / 1024).toFixed(1) + ' MB');

  try {
    // Step 1: 检测设备
    log('2/6', '检测连接设备...');
    const devices = await execAdb(['devices']);
    const lines = devices.split('\n').filter(l => l.includes('\t') && !l.includes('unauthorized'));

    if (lines.length === 0) {
      const allLines = devices.split('\n').filter(l => l.includes('\t'));
      if (allLines.some(l => l.includes('unauthorized'))) {
        console.error('\n  手机已检测但未授权! 请在手机上点击"允许 USB 调试"');
      } else {
        console.error('\n  未检测到设备。确保:');
        console.error('  1. USB 数据线已连接');
        console.error('  2. 手机上"开发者选项" -> "USB 调试"已开启');
      }
      process.exit(1);
    }

    const serial = lines[0].split('\t')[0];
    log('   ', '设备序列号: ' + serial);

    report.deviceModel = await execAdb(['shell', 'getprop', 'ro.product.model']);
    report.androidVersion = await execAdb(['shell', 'getprop', 'ro.build.version.release']);
    log('   ', '型号: ' + report.deviceModel);
    log('   ', 'Android: ' + report.androidVersion);

    // ─── 自动识别 DeviceProfile ──────────────────────
    deviceProfile = detectDeviceProfile({
      model: report.deviceModel,
      platform: 'android'
    });
    report.deviceBrand = deviceProfile.brand;
    log('   ', '品牌识别: ' + deviceProfile.brand + '/' + deviceProfile.model +
        ' | 平台: ' + deviceProfile.platform);
    if (deviceProfile.profile?.knownIssues) {
      const issues = Object.values(deviceProfile.profile.knownIssues).join('; ');
      log('   ', '已知问题: ' + issues);
    }
    logToFile('PROFILE', JSON.stringify({
      brand: deviceProfile.brand,
      model: deviceProfile.model,
      platform: deviceProfile.platform,
      elementStrategies: Object.keys(deviceProfile.profile?.elementStrategies || {})
    }));

    // Step 2: 安装 APK
    log('3/6', '安装 APK 到 ' + report.deviceModel + '...');

    // 录屏 (如果开启)
    let recordLocalPath = null;
    if (DO_RECORD) {
      recordLocalPath = await screenshotHelper.startRecording(execAdb, TIMEOUT_S + 60);
      if (recordLocalPath) log('   ', '录屏已开始: ' + recordLocalPath);
    }

    try {
      // 并行：启动安装 + 风险弹窗检测
      const installPromise = execAdbNoTimeout(['install', '-r', '-d', APK_PATH]);
      let installDone = false;

      // 启动弹窗检测，安装完成后自动停止
      dismissRiskDialog(50, function() { return installDone; }).catch(function() {});

      // 等待安装结果，如果失败则不会再尝试启动应用
      const result = await installPromise;
      installDone = true;
      log('   ', result.includes('Success') ? '安装成功' : '安装结果: ' + result);

    } catch (e) {
      log('   ', '安装提示: ' + e.message);
    }
    await sleep(2000);

    // ─── 处理安装后界面 ──────────────────────────────
    // 检测：华为帐号登录 / "完成"按钮 / "打开"按钮
    const postInstallResult = await handlePostInstallScreens({
      waitForUserTimeout: 60000,  // 等待用户输入密码最长60秒（安装其他阶段不等待）
      deviceProfile: deviceProfile
    });

    // ─── 提取应用显示名（供启动 + 探索使用） ────────────────
    let displayName = APP_NAME;
    if (!displayName) {
      displayName = await extractAppLabel(APK_PATH);
      if (displayName) log('   ', '从 APK 提取到应用名: ' + displayName);
    }

    if (postInstallResult === 'launched') {
      // 用户点击了"打开"按钮，应用已直接启动
      log('4/6', '应用已通过安装界面直接启动');
      report.appLaunchedBy = 'install_open_button';
      await sleep(3000);
    } else if (postInstallResult) {
      // 安装完成，需要手动启动应用
      log('4/6', '启动应用 ' + PACKAGE_NAME + '...');

      const launched = await launchInstalledApp(PACKAGE_NAME, displayName);
      if (launched) {
        report.appLaunchedBy = 'launch_installed_app';
        log('   ', '应用启动成功');
        await sleep(3000);
      } else {
        report.appLaunchedBy = 'launch_failed';
        log('   ', '⚠ 应用启动失败，尝试继续探索...');
        // 即使启动失败，也尝试继续（用 monkey 再试一次）
        try {
          await execAdb(['shell', 'monkey', '-p', PACKAGE_NAME, '--pct-syskeys', '0', '1'], 15000);
        } catch (me) {}
        await sleep(3000);
      }
    } else {
      log('4/6', '⚠ 安装可能失败，跳过启动直接探索');
      report.appLaunchedBy = 'install_failed_skip_launch';
    }

    // Step 4: 开始 UI 探索（使用 AppExplorer 智能引擎）
    log('5/6', '启动 App 页面智能探索引擎...');
    console.log('');

    // 验证当前是否在目标应用内（防止误启动了其他应用）
    const inTargetApp = await verifyLaunchedApp(PACKAGE_NAME);
    if (!inTargetApp) {
      log('   ', '⚠ 当前不在目标应用内 (mCurrentFocus ≠ ' + PACKAGE_NAME + ')，尝试重新启动');
      const relaunched = await launchInstalledApp(PACKAGE_NAME, displayName);
      if (!relaunched) {
        log('   ', '⚠ 重新启动失败，探索可能不准确');
      }
      await sleep(3000);
    }

    const explorer = new AppExplorer({
      execAdb: execAdb,
      captureScreen: captureScreen,
      deviceProfile: deviceProfile,
      packageName: PACKAGE_NAME,
      appName: APP_NAME || displayName || '',
      maxDepth: MAX_DEPTH,
      maxPages: 30,
      timeoutMs: TIMEOUT_S * 1000,
      doScreenshot: doScreenshot,
      logToFile: logToFile,
    });

    await explorer.explore();
    const exploreReport = explorer.getReport();

    // 合并探索结果到全局报告
    report.totalSteps = exploreReport.totalSteps;
    report.paths = exploreReport.paths;
    report.activities = exploreReport.activities;
    report.exploreDetail = exploreReport;

    console.log('\n');

    // 关闭应用
    try { await execAdb(['shell', 'am', 'force-stop', PACKAGE_NAME], 5000); } catch (e) {}

    // 停止录屏
    if (DO_RECORD && recordLocalPath) {
      const savedPath = await screenshotHelper.stopRecording(execAdb, recordLocalPath);
      if (savedPath) log('   ', '录屏已保存: ' + savedPath);
    }

    // ─── 生成报告 ────────────────────────────────────────────────
    report.endTime = new Date().toISOString();
    report.duration = Math.floor((Date.now() - startTime) / 1000);
    // report.paths 和 report.activities 已在 AppExplorer 中合并，无需重复赋值

    const markdown = generateReport(report);
    fs.writeFileSync(EXPORT_PATH, markdown, 'utf-8');

    printSummary(report);
    console.log('\n  报告已保存: ' + path.resolve(EXPORT_PATH) + '\n');

  } catch (err) {
    console.error('\n  探索失败: ' + err.message);
    report.errors.push(err.message);
    // 确保录屏在主流程失败时也停止
    if (DO_RECORD && recordLocalPath) {
      await screenshotHelper.stopRecording(execAdb, recordLocalPath).catch(() => {});
    }
    const markdown = generateReport(report);
    fs.writeFileSync(EXPORT_PATH, markdown, 'utf-8');
    console.log('\n  错误报告已保存: ' + path.resolve(EXPORT_PATH));
    process.exit(1);
  }
}

// ─── 报告生成 ──────────────────────────────────────────────────────
function generateReport(report) {
  const detail = report.exploreDetail || {};
  const pageCoverage = detail.pageCoverage || 0;
  const elementCoverage = detail.elementCoverage || 0;
  const totalPages = detail.totalPages || 0;
  const fullyExplored = detail.fullyExploredPages || 0;
  const totalInteractive = detail.totalInteractiveElements || 0;
  const interactedElems = detail.interactedElements || 0;

  let md = '# VTest Exploration Report\n\n';
  md += '**APK**: `' + report.packageName + '`\n';
  md += '**Device**: ' + report.deviceModel + ' (' + report.deviceBrand + ') (Android ' + report.androidVersion + ')\n';
  md += '**Run ID**: `' + (report.runId || 'N/A') + '`\n';
  md += '**Start**: ' + new Date(report.startTime).toLocaleString() + '\n';
  md += '**End**: ' + new Date(report.endTime).toLocaleString() + '\n';
  md += '**Duration**: ' + report.duration + ' seconds\n';
  md += '**Screenshots**: ' + (report.screenshots || 'disabled') + '\n';
  md += '**App Launch**: ' + (report.appLaunchedBy || 'N/A') + '\n\n';
  md += '---\n\n';

  // ── 覆盖率摘要 ──
  md += '## Coverage Summary\n\n';
  md += '| Metric | Value |\n|--------|-------|\n';
  md += '| Max Depth | ' + report.maxDepth + ' |\n';
  md += '| Steps Executed | ' + (detail.totalSteps || 0) + ' |\n';
  md += '| Pages Found | ' + totalPages + ' |\n';
  md += '| Pages Fully Explored | ' + fullyExplored + ' |\n';
  md += '| Page Coverage | ' + pageCoverage + '% |\n';
  md += '| Interactive Elements | ' + totalInteractive + ' |\n';
  md += '| Elements Interacted | ' + interactedElems + ' |\n';
  md += '| Element Coverage | ' + elementCoverage + '% |\n';
  md += '| Activities Found | ' + (report.activities ? report.activities.length : 0) + ' |\n';
  md += '| Errors | ' + (detail.errors ? detail.errors.length : report.errors.length) + ' |\n\n';

  // ── 操作统计 ──
  const actionStats = detail.actionStats || {};
  md += '## Action Statistics\n\n';
  md += '| Action Type | Count |\n|-------------|-------|\n';
  for (const [action, count] of Object.entries(actionStats)) {
    md += '| ' + action + ' | ' + count + ' |\n';
  }
  md += '\n';

  // ── Activities ──
  md += '## Activities Discovered\n\n';
  if (!report.activities || report.activities.length === 0) md += '(none)\n\n';
  else report.activities.forEach(function(a, i) {
    md += (i + 1) + '. `' + a + '`\n';
  });

  // ── 页面覆盖详情（核心新增） ──
  md += '\n## Page Coverage Details\n\n';
  const pageDetails = detail.pageDetails || [];
  if (pageDetails.length === 0) {
    md += '(no pages explored)\n\n';
  } else {
    // 表格概览
    md += '| # | Page | Activity | Nav | Action | Input | Scroll | Coverage | Status |\n';
    md += '|---|------|----------|-----|--------|-------|--------|----------|--------|\n';
    pageDetails.forEach(function(p, i) {
      const status = p.fullyExplored ? '✅ Complete' : '⚠ Partial';
      md += '| ' + (i + 1) + ' | ' + p.label + ' | ' +
        (p.activity ? p.activity.split('.').pop() : '?') + ' | ' +
        p.navCount + ' | ' + p.actionCount + ' | ' + p.inputCount + ' | ' +
        p.scrollCount + ' | ' + p.coverage + '% | ' + status + ' |\n';
    });
    md += '\n';

    // 每页详细元素列表
    md += '### Per-Page Element Inventory\n\n';
    pageDetails.forEach(function(p, i) {
      md += '#### Page #' + (i + 1) + ': ' + p.label + '\n\n';
      md += '- Activity: `' + (p.activity || 'unknown') + '`\n';
      md += '- Visits: ' + p.visitCount + ' | Coverage: ' + p.coverage + '% | ' +
        (p.fullyExplored ? 'Complete ✅' : 'Partial ⚠') + '\n';

      if (p.elements && p.elements.length > 0) {
        md += '\n| Type | Element | Class | Clickable | Resource-ID | Bounds | Interacted |\n';
        md += '|------|---------|-------|-----------|-------------|--------|------------|\n';
        p.elements.forEach(function(e) {
          md += '| ' + e.type + ' | ' + (e.text || '(empty)') + ' | ' +
            e.cls + ' | ' + e.clickable + ' | ' + (e.resourceId || '-') + ' | ' +
            '[' + e.bounds.join(',') + '] | ' + (e.interacted ? '✅' : '❌') + ' |\n';
        });
      }
      md += '\n';
    });
  }

  // ── Exploration Paths ──
  md += '\n## Exploration Paths\n\n';
  const paths = report.paths || [];
  if (paths.length === 0) md += '(none)\n\n';
  else paths.slice(0, 50).forEach(function(p, i) {
    md += '### Path #' + (i + 1) + '\n';
    md += '- Start: `' + (p.startActivity ? p.startActivity.split('.').pop() : '?') + '`\n';
    md += '- Action: ' + p.action + ' → ' + (p.element || '?') + '\n';
    if (p.inputValue) md += '- Input: "' + p.inputValue + '"\n';
    if (p.x && p.y) md += '- Coordinates: [' + p.x + ', ' + p.y + ']\n';
    md += '\n';
  });

  // ── Errors ──
  md += '## Errors\n\n';
  const errors = detail.errors || report.errors || [];
  if (errors.length === 0) md += '(none)\n\n';
  else errors.forEach(function(e, i) {
    md += (i + 1) + '. ' + e + '\n';
  });

  md += '\n---\n*Generated by VTest v3.0 (AppExplorer) | ' + new Date().toISOString() + '*\n';
  return md;
}

// ─── 输出 ──────────────────────────────────────────────────────────
function printSummary(report) {
  const detail = report.exploreDetail || {};

  console.log('═══════════════════════════════════════════');
  console.log('  VTest Exploration Complete (v3.0)');
  console.log('═══════════════════════════════════════════');
  console.log('  Run ID:    ' + (report.runId || 'N/A'));
  console.log('  App:       ' + report.packageName);
  console.log('  Device:    ' + report.deviceModel + ' (' + report.deviceBrand + ')' +
    (report.androidVersion ? ' Android ' + report.androidVersion : ''));
  console.log('  Launch:    ' + (report.appLaunchedBy || 'N/A'));
  console.log('  Duration:  ' + report.duration + 's');
  console.log('');
  console.log('  ── Coverage ─────────────────────────────');
  console.log('  Pages:      ' + (detail.totalPages || 0) + ' found / ' +
    (detail.fullyExploredPages || 0) + ' fully explored');
  console.log('  Page Cov:   ' + (detail.pageCoverage || 0) + '%');
  console.log('  Elements:   ' + (detail.interactedElements || 0) + '/' +
    (detail.totalInteractiveElements || 0) + ' interacted');
  console.log('  Elem Cov:   ' + (detail.elementCoverage || 0) + '%');
  console.log('  Steps:      ' + (detail.totalSteps || 0));
  console.log('  Screens:    ' + (report.activities ? report.activities.length : 0));
  console.log('  Errors:     ' + (detail.errors ? detail.errors.length : report.errors.length));
  console.log('  Log:        ' + screenshotHelper.getCurrentLogFile());
  if (report.screenshots) console.log('  Shots:      ' + report.screenshots);
  console.log('');

  // ── 操作类型统计 ──
  const actionStats = detail.actionStats || {};
  if (Object.keys(actionStats).length > 0) {
    console.log('  ── Action Types ────────────────────────');
    for (const [action, count] of Object.entries(actionStats)) {
      console.log('  ' + action + ': ' + count);
    }
    console.log('');
  }

  // ── 页面覆盖明细 ──
  const pageDetails = detail.pageDetails || [];
  if (pageDetails.length > 0) {
    console.log('  ── Pages Discovered ────────────────────');
    pageDetails.forEach(function(p, i) {
      const status = p.fullyExplored ? '✅' : '⚠';
      console.log('    ' + (i + 1) + '. ' + status + ' ' + p.label +
        ' (nav:' + p.navCount + ' act:' + p.actionCount +
        ' inp:' + p.inputCount + ' cov:' + p.coverage + '%)');
    });
  }
}

runExploration().catch(console.error);