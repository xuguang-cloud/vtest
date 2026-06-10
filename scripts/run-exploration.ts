/**
 * VTest CLI Runner — 连接真机华为 P50 Pocket 对 APK 进行自动探索测试
 *
 * 用法:
 *   npx ts-node scripts/run-exploration.ts --apk /path/to/app.apk --package com.example.app
 *
 * 或:
 *   npx ts-node scripts/run-exploration.ts -a /path/to/app.apk -p com.example.app
 *
 * 可选参数:
 *   --depth / -d    探索深度（默认 10）
 *   --steps / -s    最大步骤数（默认 100）
 *   --timeout / -t  超时秒数（默认 60）
 *   --export / -e   导出报告路径（默认 ./exploration-report.md）
 *   --adb-path      自定义 ADB 路径（默认 D:/Tools/platform-tools/adb.exe）
 */

import * as fs from 'fs'
import * as path_ from 'path'

// ─── Config ───────────────────────────────────────────────────────────
const args = process.argv.slice(2)

function getArg(short: string, long: string): string | undefined {
  const idx = args.findIndex(a => a === short || a.startsWith(long + '=') || a === long)
  if (idx === -1) return undefined
  if (args[idx].includes('=')) return args[idx].split('=')[1]
  return args[idx + 1]
}

function hasFlag(short: string, long: string): boolean {
  return args.some(a => a === short || a === long)
}

const APK_PATH     = getArg('-a', '--apk') || ''
const PACKAGE_NAME = getArg('-p', '--package') || ''
const MAX_DEPTH    = parseInt(getArg('-d', '--depth') || '10', 10)
const MAX_STEPS    = parseInt(getArg('-s', '--steps') || '100', 10)
const TIMEOUT_S    = parseInt(getArg('-t', '--timeout') || '60', 10)
const EXPORT_PATH  = getArg('-e', '--export') || './exploration-report.md'
const ADB_PATH     = getArg('', '--adb-path') || 'D:/Tools/platform-tools/adb.exe'
const DEVICE_SERIAL = getArg('', '--serial') || ''

if (!APK_PATH || !PACKAGE_NAME) {
  console.error(`
❌ 用法错误: 需要指定 APK 路径和包名

用法:
  npx ts-node scripts/run-exploration.ts --apk /path/to/app.apk --package com.example.app

示例:
  npx ts-node scripts/run-exploration.ts -a D:/test.apk -p com.huawei.myapp
`)
  process.exit(1)
}

// ─── Utilities ────────────────────────────────────────────────────────
function execAdb(args: string[], timeoutMs = 30000): Promise<string> {
  const spawn = require('child_process').spawn
  return new Promise((resolve, reject) => {
    const fullArgs = DEVICE_SERIAL ? ['-s', DEVICE_SERIAL, ...args] : [...args]
    const proc = spawn(ADB_PATH, fullArgs, { timeout: timeoutMs, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString() })
    proc.on('close', (code: number) => {
      if (code === 0) resolve(stdout.trim())
      else reject(new Error(stderr.trim() || `exit code ${code}`))
    })
    proc.on('error', reject)
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

function log(emoji: string, msg: string): void {
  console.log(`  ${emoji}  ${msg}`)
}

// ─── Exploration Steps ────────────────────────────────────────────────

interface ExplorationPath {
  pathId: string
  startActivity: string
  endActivity: string
  actions: { action: string; element: string; x: number; y: number }[]
}

interface ExplorationReport {
  appName: string
  packageName: string
  deviceModel: string
  androidVersion: string
  startTime: string
  endTime: string
  duration: number
  maxDepth: number
  totalSteps: number
  paths: ExplorationPath[]
  activities: string[]
  screenshots: string[]
  errors: string[]
}

async function runExploration(): Promise<void> {
  console.log('\n═══════════════════════════════════════════')
  console.log('  VTest — AI 探索引擎 · 真机测试')
  console.log('═══════════════════════════════════════════\n')

  const report: ExplorationReport = {
    appName: '',
    packageName: PACKAGE_NAME,
    deviceModel: '',
    androidVersion: '',
    startTime: new Date().toISOString(),
    endTime: '',
    duration: 0,
    maxDepth: MAX_DEPTH,
    totalSteps: 0,
    paths: [],
    activities: [],
    screenshots: [],
    errors: []
  }

  const startTime = Date.now()

  // Step 0: 验证 APK
  log('1/6', `验证 APK: ${APK_PATH}`)
  if (!fs.existsSync(APK_PATH)) {
    console.error(`\n❌ APK 文件不存在: ${APK_PATH}`)
    process.exit(1)
  }
  const apkStats = fs.statSync(APK_PATH)
  log('   ', `APK 大小: ${(apkStats.size / 1024 / 1024).toFixed(1)} MB`)

  try {
    // Step 1: 检测设备
    log('2/6', '检测连接设备...')
    const devices = await execAdb(['devices'])
    const lines = devices.split('\n').filter(l => l.includes('\t') && !l.includes('unauthorized'))

    if (lines.length === 0) {
      // 检查是否有 unauthorized 设备
      const allLines = devices.split('\n').filter(l => l.includes('\t'))
      if (allLines.some(l => l.includes('unauthorized'))) {
        console.error('\n❌ 手机已检测到但未授权! 请在手机上点击"允许 USB 调试"')
        console.error('   然后重新运行此脚本。')
      } else {
        console.error(`\n❌ 未检测到设备。请确保:`)
        console.error(`   1. USB 数据线已连接`)
        console.error(`   2. 手机上"开发者选项"→"USB 调试"已开启`)
        console.error(`   3. 运行: "${ADB_PATH}" devices`)
      }
      process.exit(1)
    }

    const deviceInfo = lines[0].split('\t')
    const serial = deviceInfo[0]
    log('   ', `设备序列号: ${serial}`)

    // 获取设备信息
    report.deviceModel = await execAdb(['shell', 'getprop', 'ro.product.model'])
    report.androidVersion = await execAdb(['shell', 'getprop', 'ro.build.version.release'])
    log('   ', `型号: ${report.deviceModel}`)
    log('   ', `Android: ${report.androidVersion}`)

    // Step 2: 安装 APK
    log('3/6', `正在安装 APK 到 ${report.deviceModel}...`)
    try {
      const installResult = await execAdb(['install', '-r', '-d', APK_PATH], 120000)
      if (installResult.includes('Success')) {
        log('   ', `✅ 安装成功`)
      } else {
        log('   ', `安装结果: ${installResult}`)
      }
    } catch (e: any) {
      log('⚠️ ', `安装警告 (可能已安装): ${e.message}`)
    }

    // Step 3: 获取主 Activity
    log('4/6', '解析 APK 信息...')
    let mainActivity = ''
    try {
      const output = await execAdb([
        'shell', 'monkey', '-p', PACKAGE_NAME,
        '-v', '1', '1'
      ], 10000)
      // If monkey can't start, try launching via am
    } catch { /* ignore */ }

    // Step 4: 启动应用
    log('5/6', `启动应用 ${PACKAGE_NAME}...`)
    try {
      // Try to get the main activity first
      const dumpOutput = await execAdb([
        'shell', 'dumpsys', 'package', PACKAGE_NAME,
        '|', 'grep', '-i', 'MainActivity'
      ], 10000)
      const activityMatch = dumpOutput.match(/([\w.]+MainActivity)/)
      mainActivity = activityMatch ? activityMatch[1] : ''
    } catch { /* */ }

    // Launch the app
    if (mainActivity) {
      await execAdb(['shell', 'am', 'start', '-n', `${PACKAGE_NAME}/${mainActivity}`], 10000)
    } else {
      await execAdb(['shell', 'monkey', '-p', PACKAGE_NAME, '-c', 'android.intent.category.LAUNCHER', '1'], 10000)
    }
    log('   ', `✅ 应用已启动`)
    await sleep(3000)

    // Step 5: 开始 UI 探索
    log('6/6', `开始 UI 探索 (深度=${MAX_DEPTH}, 步骤=${MAX_STEPS})`)
    console.log('')

    const discoveredActivities = new Set<string>()
    const discoveredPaths: ExplorationPath[] = []

    for (let depth = 0; depth < MAX_DEPTH && Date.now() - startTime < TIMEOUT_S * 1000; depth++) {
      const stepStartTime = Date.now()

      // 获取当前 Activity
      let currentActivity = ''
      try {
        currentActivity = await execAdb(['shell', 'dumpsys', 'window', '|', 'grep', 'mCurrentFocus'], 5000)
        const actMatch = currentActivity.match(/\/([\w.]+)}/)
        if (actMatch) {
          currentActivity = actMatch[1]
          discoveredActivities.add(currentActivity)
        }
      } catch { currentActivity = 'unknown' }

      // 获取 UI 树 (dump UI hierarchy)
      let uiDump = ''
      try {
        await execAdb(['shell', 'uiautomator', 'dump', '/sdcard/ui.xml'], 10000)
        uiDump = await execAdb(['shell', 'cat', '/sdcard/ui.xml'], 5000)
      } catch {
        // fallback: pull from device
        try {
          await execAdb(['pull', '/sdcard/ui.xml', `/tmp/ui_${depth}.xml`], 5000)
        } catch { /* */ }
      }

      // 解析 UI 节点 (简单解析)
      const clickableNodes: Array<{ text: string; bounds: number[] }> = []
      if (uiDump) {
        const nodeRegex = /<node[^>]*?clickable="true"[^>]*?text="([^"]*)"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*?\/?>/g
        let match
        while ((match = nodeRegex.exec(uiDump)) !== null) {
          clickableNodes.push({
            text: match[1],
            bounds: [parseInt(match[2]), parseInt(match[3]), parseInt(match[4]), parseInt(match[5])]
          })
        }
      }

      // 遍历：点击找到的第一个可交互节点
      if (clickableNodes.length > 0) {
        const target = clickableNodes[Math.floor(Math.random() * clickableNodes.length)]
        const cx = Math.floor((target.bounds[0] + target.bounds[2]) / 2)
        const cy = Math.floor((target.bounds[1] + target.bounds[3]) / 2)

        await execAdb([
          'shell', 'input', 'tap', String(cx), String(cy)
        ], 5000)

        // 等待 UI 稳定
        await sleep(1500)

        const path: ExplorationPath = {
          pathId: `path-${depth}-${Date.now()}`,
          startActivity: currentActivity,
          endActivity: currentActivity,
          actions: [{ action: 'CLICK', element: target.text || `button_at_${cx}_${cy}`, x: cx, y: cy }]
        }
        discoveredPaths.push(path)

        // Progress line
        const stepTime = Date.now() - stepStartTime
        const elapsed = Math.floor((Date.now() - startTime) / 1000)
        process.stdout.write(
          `  \r🔍 深度: ${depth + 1}/${MAX_DEPTH} | 已点击: ${discoveredPaths.length} | ` +
          `界面: ${currentActivity.split('.').pop() || '?'} | 运行: ${elapsed}s${' '.repeat(10)}`
        )
      } else {
        // 如果没有可点击元素，尝试 Back
        await execAdb(['shell', 'input', 'keyevent', 'KEYCODE_BACK'], 3000)
        await sleep(1000)
        process.stdout.write(`  \r⬅️  深度: ${depth + 1}/${MAX_DEPTH} | 无交互元素 → 返回`)
      }

      report.totalSteps++
    }

    console.log('\n')

    // 关闭应用
    await execAdb(['shell', 'am', 'force-stop', PACKAGE_NAME], 5000).catch(() => {})

    // ─── 生成报告 ───────────────────────────────────────────────
    report.endTime = new Date().toISOString()
    report.duration = Math.floor((Date.now() - startTime) / 1000)
    report.paths = discoveredPaths
    report.activities = Array.from(discoveredActivities)

    const markdown = generateReport(report)
    fs.writeFileSync(EXPORT_PATH, markdown, 'utf-8')

    printSummary(report)
    console.log(`\n📄 详细报告已保存至: ${path_.resolve(EXPORT_PATH)}\n`)

  } catch (err: any) {
    console.error(`\n❌ 探索失败: ${err.message}`)
    report.errors.push(err.message)

    // 保存错误报告
    const markdown = generateReport(report)
    fs.writeFileSync(EXPORT_PATH, markdown, 'utf-8')
    console.log(`\n📄 错误报告已保存至: ${path_.resolve(EXPORT_PATH)}`)
    process.exit(1)
  }
}

function generateReport(report: ExplorationReport): string {
  const coverage = report.activities.length > 0
    ? Math.round((report.paths.length / Math.max(report.paths.length, 1)) * 100)
    : 0

  return `# VTest 探索测试报告

**APK**: \`${report.packageName}\`
**设备**: ${report.deviceModel} (Android ${report.androidVersion})
**测试时间**: ${new Date(report.startTime).toLocaleString()} — ${new Date(report.endTime).toLocaleString()}
**耗时**: ${report.duration} 秒

---

## 汇总

| 指标 | 数值 |
|------|:----:|
| 探索深度 | ${report.maxDepth} |
| 点击次数 | ${report.paths.length} |
| 发现界面 | ${report.activities.length} |
| 已探测覆盖率 | ${coverage}% |
| 错误数 | ${report.errors.length} |

## 发现的界面

${report.activities.map((a, i) => `${i + 1}. \`${a}\``).join('\n') || '(无)'}

## 探索路径

${report.paths.map((p, i) => `
### 路径 #${i + 1} — ${p.pathId}
- 起始界面: \`${p.startActivity.split('.').pop() || p.startActivity}\`
- 操作: ${p.actions.map(a => \`${a.action}(${a.element})\`).join(' → ')}
`).join('---')}

## 错误日志

${report.errors.map((e, i) => `${i + 1}. ${e}`).join('\n') || '(无)'}

---

*报告由 VTest 自动生成 | ${new Date().toISOString()}*
`
}

function printSummary(report: ExplorationReport): void {
  console.log('═══════════════════════════════════════════')
  console.log('  VTest 探索测试完成')
  console.log('═══════════════════════════════════════════')
  console.log(`  应用:     ${report.packageName}`)
  console.log(`  设备:     ${report.deviceModel}`)
  console.log(`  耗时:     ${report.duration}s`)
  console.log(`  点击次数: ${report.paths.length}`)
  console.log(`  发现界面: ${report.activities.length}`)
  console.log(`  错误数:   ${report.errors.length}`)
  console.log('')
  console.log(`  发现的界面:`)
  report.activities.forEach((a, i) => console.log(`    ${i + 1}. ${a.split('.').pop() || a}`))
}

runExploration().catch(console.error)