/**
 * VTest App 页面智能探索引擎
 *
 * 核心问题解决: 当前探索只是"随机点击 clickable 元素"，完全没有：
 *   - 系统性页面覆盖（每个页面都应完整浏览）
 *   - 元素分类采集（导航/功能/内容/输入 要分别处理）
 *   - 滚动探索（列表要滑到底，滚动区域要翻遍）
 *   - 输入探索（EditText 要输入测试数据）
 *   - 去重复（已访问页面不重复探索）
 *   - 回退策略（发现重复自动 Back）
 *
 * 设计原则:
 *   1. 页面指纹 — Activity + 可见文本 hash 识别重复页面
 *   2. 元素分类 — 导航/功能/输入/内容/滚动 5 大类
 *   3. 优先级策略 — 导航优先 → 功能 → 滚动 → 输入
 *   4. 每步双采集 — 截屏 + 完整元素树
 *   5. 全覆盖报告 — 页面/功能/元素覆盖率统计
 *
 * 用法（被 run-exploration.js 引用，不直接运行）:
 *   const AppExplorer = require('./app-explorer');
 *   const explorer = new AppExplorer({ execAdb, captureScreen, deviceProfile, ... });
 *   await explorer.explore();
 *   const report = explorer.getReport();
 */

const crypto = require('crypto');

// ═══════════════════════════════════════════════════
// 一、页面指纹 — PageFingerprint
// ═══════════════════════════════════════════════════

/**
 * 页面指纹 = currentActivity + sorted(visible_texts) 的 SHA256 hash
 *
 * 为什么不用纯 Activity?
 *   - 同一 Activity 不同状态（Tab切换、列表翻页）→ 需要文本区分
 *   - 不同 Activity 相同 UI（空壳壳子）→ Activity 区分
 *
 * 为什么排序文本?
 *   - 相同页面不同 dump 顺序 → hash 不变
 *   - 避免"刷新后元素微调位置"导致误判新页面
 */
class PageFingerprint {
  constructor(activity, visibleTexts, clickableCount, inputCount) {
    this.activity = activity || 'unknown';
    this.visibleTexts = visibleTexts || [];
    this.clickableCount = clickableCount || 0;
    this.inputCount = inputCount || 0;

    // 去重 + 排序 + hash
    const uniqueSorted = [...new Set(this.visibleTexts)].sort();
    const raw = this.activity + '|' + uniqueSorted.join('|');
    this.hash = crypto.createHash('sha256').update(raw, 'utf8').digest('hex').substring(0, 12);

    // 简短标签: Activity 最后一段 + 文本摘要
    const actShort = this.activity.split('.').pop() || this.activity;
    const textShort = uniqueSorted.slice(0, 3).join(',').substring(0, 30);
    this.label = actShort + '{' + textShort + '}';
  }

  equals(other) {
    return this.hash === other.hash;
  }

  toString() {
    return this.label + ' [hash=' + this.hash + ']';
  }
}

// ═══════════════════════════════════════════════════
// 二、元素分类器 — ElementClassifier
// ═══════════════════════════════════════════════════

/**
 * 元素 5 大类:
 *
 *   NAV     导航类 — Tab/菜单/底部导航栏/Drawer触发器
 *           特征: text 简短(2-6字), 通常在页面顶部/底部固定区域
 *           策略: 优先点击，展开新页面
 *
 *   ACTION  功能类 — 按钮/开关/链接
 *           特征: clickable=true, text 短(2-10字), 或 content-desc 含操作语义
 *           策略: 依次点击触发功能
 *
 *   INPUT   输入类 — EditText/SearchBox/密码框
 *           特征: class 含 EditText/SearchView/AutoCompleteTextView
 *           策略: 输入测试数据 + 回车
 *
 *   CONTENT 内容类 — 纯文本/图片/标签
 *           特征: 不可点击, 有 text/content-desc
 *           策略: 只记录不交互（但可能被滚动揭示出可交互元素）
 *
 *   SCROLL  滚动类 — ScrollView/RecyclerView/ListView/ViewPager
 *           特征: class 含 ScrollView/RecyclerView/ListView/ViewPager
 *                 或 scrollable=true
 *           策略: 滑动到底，逐帧采集元素
 */
const ELEMENT_TYPES = {
  NAV:     'nav',
  ACTION:  'action',
  INPUT:   'input',
  CONTENT: 'content',
  SCROLL:  'scroll'
};

// 导航类关键词（底部导航栏/Tab/菜单）
const NAV_KEYWORDS = [
  // 底部导航栏常见文案
  '首页', '发现', '消息', '我的', '设置', '搜索',
  '推荐', '热门', '关注', '收藏', '历史', '下载',
  '主页', '动态', '圈子', '社区', '附近',
  // 英文 Tab
  'Home', 'Discover', 'Search', 'Profile', 'Me', 'More',
  'News', 'Chat', 'Message', 'Settings', 'Explore',
  // 通用导航
  '全部', '分类', '筛选', '更多',
];

// 功能类关键词（操作按钮）
const ACTION_KEYWORDS = [
  '打印', '扫描', '分享', '删除', '添加', '创建', '编辑', '保存',
  '确认', '取消', '提交', '上传', '下载', '刷新', '同步', '发送',
  '连接', '断开', '开启', '关闭', '安装', '卸载', '登录', '注册',
  '播放', '暂停', '停止', '录音', '拍照', '截图',
  '同意', '拒绝', '允许', '下一步', '上一步', '跳过', '返回',
  '完成', '打开', '选择', '复制', '剪切', '粘贴',
];

// 输入框 class 名称模式
const INPUT_CLASS_PATTERNS = [
  'EditText', 'SearchView', 'AutoCompleteTextView',
  'TextInput', 'InputField', 'EditTextInput',
];

// 滚动容器 class 名称模式
const SCROLL_CLASS_PATTERNS = [
  'ScrollView', 'RecyclerView', 'ListView', 'ViewPager',
  'HorizontalScrollView', 'NestedScrollView', 'WebView',
  'SwipeRefreshLayout',
];

/**
 * 分类一个 UI 元素节点
 *
 * @param {Object} node — 从 uiautomator XML 解析的节点
 *   { text, cls, clickable, checkable, scrollable, bounds, resourceId, contentDesc }
 * @returns {string} 元素类型 (ELEMENT_TYPES 之一)
 */
function classifyElement(node) {
  const cls = (node.cls || '').toLowerCase();
  const text = (node.text || '').trim();
  const rid = (node.resourceId || '').toLowerCase();
  const cdesc = (node.contentDesc || '').trim();
  const clickable = node.clickable === 'true';
  const scrollable = node.scrollable === 'true';
  const bounds = node.bounds || [0, 0, 0, 0];
  const width = bounds[2] - bounds[0];
  const height = bounds[3] - bounds[1];

  // ─── 1. 滚动类 — 最先判断（scrollable 属性权威） ───
  if (scrollable) return ELEMENT_TYPES.SCROLL;
  for (const pattern of SCROLL_CLASS_PATTERNS) {
    if (cls.includes(pattern.toLowerCase())) return ELEMENT_TYPES.SCROLL;
  }

  // ─── 2. 输入类 — class 含 EditText 等 ───
  for (const pattern of INPUT_CLASS_PATTERNS) {
    if (cls.includes(pattern.toLowerCase())) return ELEMENT_TYPES.INPUT;
  }
  // 兜底: resource-id 含 search/edit/input
  if (rid.includes('search') || rid.includes('edit') || rid.includes('input')) {
    return ELEMENT_TYPES.INPUT;
  }

  // ─── 3. 导航类 — 短文本 + 可点击 + 在导航区域 ───
  if (clickable && text.length >= 1 && text.length <= 8) {
    // 精确关键词匹配
    if (NAV_KEYWORDS.some(kw => text === kw)) return ELEMENT_TYPES.NAV;
    // resource-id 含 tab/nav/bottom/tab_bar/menu
    if (rid.includes('tab') || rid.includes('nav') || rid.includes('bottom') ||
        rid.includes('menu') || rid.includes('drawer')) {
      return ELEMENT_TYPES.NAV;
    }
    // 页面底部区域（y > 屏幕 80%）的短可点击文字 → 底部导航栏
    // 典型华为 1080x1920: 底部导航栏 y > 1700
    if (bounds[1] > 1700 && text.length <= 6) return ELEMENT_TYPES.NAV;
  }

  // ─── 4. 功能类 — 可点击 + 操作关键词 ───
  if (clickable) {
    // 精确关键词匹配
    if (ACTION_KEYWORDS.some(kw => text === kw)) return ELEMENT_TYPES.ACTION;
    // 含操作语义但不太长（功能按钮通常短）
    if (text.length >= 1 && text.length <= 12 && clickable) {
      // 有 content-desc 含操作语义
      if (cdesc && ACTION_KEYWORDS.some(kw => cdesc === kw)) return ELEMENT_TYPES.ACTION;
    }
    // 所有可点击 + 有文字的 → 如果不是 NAV 就是 ACTION
    if (text.length > 0 && text.length <= 20) return ELEMENT_TYPES.ACTION;
    // 可点击 + 无文字 → 可能是图标按钮
    if (text === '' && clickable) return ELEMENT_TYPES.ACTION;
  }

  // ─── 5. 内容类 — 兜底 ───
  return ELEMENT_TYPES.CONTENT;
}

// ═══════════════════════════════════════════════════
// 三、探索引擎 — AppExplorer
// ═══════════════════════════════════════════════════

/**
 * 测试输入数据 — 针对不同输入框类型
 */
const TEST_INPUT_DATA = {
  // 通用搜索
  search: '测试',
  // 打印机搜索
  printer_search: '小米',
  // 用户名
  username: 'testuser',
  // 密码
  password: 'Test1234!',
  // 邮箱
  email: 'test@example.com',
  // 手机号
  phone: '13800138000',
  // 数字
  number: '1',
  // URL
  url: 'https://www.example.com',
  // 通用
  generic: 'Hello',
};

class AppExplorer {
  /**
   * @param {Object} options
   *   - execAdb: ADB 执行函数
   *   - captureScreen: 截屏函数
   *   - deviceProfile: DeviceProfile 对象
   *   - packageName: 包名
   *   - appName: 应用显示名
   *   - maxDepth: 最大探索深度 (默认 15)
   *   - maxPages: 最大页面数 (默认 30)
   *   - timeoutMs: 超时毫秒 (默认 180000 = 3分钟)
   *   - doScreenshot: 是否截屏
   *   - logToFile: 日志函数
   */
  constructor(options) {
    this.execAdb = options.execAdb;
    this.captureScreen = options.captureScreen || (() => Promise.resolve(null));
    this.deviceProfile = options.deviceProfile;
    this.packageName = options.packageName;
    this.appName = options.appName || '';
    this.maxDepth = options.maxDepth || 15;
    this.maxPages = options.maxPages || 30;
    this.timeoutMs = options.timeoutMs || 180000;  // 3 分钟
    this.doScreenshot = options.doScreenshot || false;
    this.logToFile = options.logToFile || (() => {});

    // 探索状态
    this.startTime = Date.now();
    this.visitedPages = new Map();     // hash → PageVisitRecord
    this.currentPage = null;           // 当前页面指纹
    this.allElements = new Map();      // 全局元素采集 hash → element
    this.interactedElements = new Set();  // 已交互元素 ID
    this.allActivities = new Set();
    this.navTree = [];                 // 导航树
    this.scrollDepths = new Map();     // scrollable 区域已滚动次数
    this.backStack = [];               // 页面回退栈（手动维护）
    this.errors = [];
    this.stepCount = 0;
    this.discoveredPaths = [];

    // 屏幕尺寸（从设备 profile 或默认）
    this.screenWidth = this.deviceProfile?.profile?.screenDefaults?.width || 1080;
    this.screenHeight = this.deviceProfile?.profile?.screenDefaults?.height || 1920;
  }

  // ─── 核心入口 ──────────────────────────────────────

  /**
   * 执行完整 App 探索
   *
   * 流程:
   *   Phase 1: 页面扫描 — dump UI → 采集元素 → 分类 → 生成指纹
   *   Phase 2: 优先展开导航（Tab/菜单/底部栏）
   *   Phase 3: 功能交互（逐个点击功能按钮）
   *   Phase 4: 滚动探索（列表/滚动区域翻到底）
   *   Phase 5: 输入探索（输入框填充测试数据）
   *   Phase 6: 回退到上一层继续探索
   *   重复 Phase 1~6 直到所有页面覆盖或超时
   */
  async explore() {
    console.log('\n  ─── App 页面智能探索引擎启动 ───');
    console.log('  最大深度: ' + this.maxDepth + ' | 最大页面: ' + this.maxPages +
      ' | 超时: ' + (this.timeoutMs / 1000) + 's\n');

    this.logToFile('EXPLORE', '探索引擎启动: maxDepth=' + this.maxDepth +
      ' maxPages=' + this.maxPages + ' timeout=' + this.timeoutMs);

    // 主循环
    for (let step = 0; step < this.maxDepth; step++) {
      // ── 超时检查 ──
      if (Date.now() - this.startTime > this.timeoutMs) {
        console.log('\n  探索超时（' + Math.floor(this.timeoutMs / 1000) + 's），停止');
        break;
      }

      // ── 页面数量检查 ──
      if (this.visitedPages.size >= this.maxPages) {
        console.log('\n  已覆盖 ' + this.visitedPages.size + ' 个页面，达到上限');
        break;
      }

      // ── Phase 1: 页面扫描 ──
      const pageData = await this.scanCurrentPage();

      if (!pageData) {
        // dump 失败，尝试 Back 回退
        console.log('   页面扫描失败，回退...');
        this.logToFile('EXPLORE', '扫描失败，尝试 Back');
        await this.goBack();
        continue;
      }

      // 检查是否已访问此页面
      const fingerprint = pageData.fingerprint;
      const alreadyVisited = this.visitedPages.has(fingerprint.hash);

      if (alreadyVisited) {
        const prevVisit = this.visitedPages.get(fingerprint.hash);
        console.log('   [重复页面] ' + fingerprint.label + ' (第' + (prevVisit.visitCount + 1) + '次访问)');
        this.logToFile('EXPLORE', '重复页面: ' + fingerprint.label + ' visitCount=' + (prevVisit.visitCount + 1));

        // 重复 3+ 次 → 强制 Back 回退
        if (prevVisit.visitCount >= 3) {
          console.log('   页面重复超过3次，强制回退');
          this.logToFile('EXPLORE', '强制回退: 重复次数>3');
          await this.goBack();
          continue;
        }

        // 重复但还没完全探索此页面 → 继续探索未交互元素
        prevVisit.visitCount++;
      } else {
        // 新页面！
        console.log('   [新页面] ' + fingerprint.label);
        this.logToFile('EXPLORE', '新页面: ' + fingerprint.label +
          ' nav=' + pageData.navElements.length +
          ' action=' + pageData.actionElements.length +
          ' input=' + pageData.inputElements.length +
          ' scroll=' + pageData.scrollElements.length);

        // 记录新页面
        this.visitedPages.set(fingerprint.hash, {
          fingerprint: fingerprint,
          visitCount: 1,
          firstSeen: Date.now(),
          elements: pageData.allElements,
          navElements: pageData.navElements,
          actionElements: pageData.actionElements,
          inputElements: pageData.inputElements,
          scrollElements: pageData.scrollElements,
          interacted: new Set(),     // 此页面已交互的元素 ID
          fullyExplored: false,       // 此页面是否完全探索过
          screenshot: null,
          activity: pageData.currentActivity,
        });

        // 新页面截屏
        if (this.doScreenshot) {
          const shot = await this.captureScreen('page-' + fingerprint.hash);
          this.visitedPages.get(fingerprint.hash).screenshot = shot;
        }

        // 记录 Activity
        if (pageData.currentActivity !== 'unknown') {
          this.allActivities.add(pageData.currentActivity);
        }

        // 添加到回退栈
        this.backStack.push(fingerprint.hash);
      }

      this.currentPage = fingerprint;
      const pageVisit = this.visitedPages.get(fingerprint.hash);

      // ── Phase 2: 优先展开导航 ──
      const navAction = await this.exploreNavElements(pageData, pageVisit);
      if (navAction) {
        this.stepCount++;
        continue;  // 点击了导航 → 期待新页面
      }

      // ── Phase 3: 功能交互 ──
      const actionResult = await this.exploreActionElements(pageData, pageVisit);
      if (actionResult) {
        this.stepCount++;
        continue;
      }

      // ── Phase 4: 滚动探索 ──
      const scrollResult = await this.exploreScrollElements(pageData, pageVisit);
      if (scrollResult) {
        this.stepCount++;
        continue;  // 滚动可能揭示新元素 → 重新扫描
      }

      // ── Phase 5: 输入探索 ──
      const inputResult = await this.exploreInputElements(pageData, pageVisit);
      if (inputResult) {
        this.stepCount++;
        continue;
      }

      // ── 当前页面完全探索 → 标记并回退 ──
      pageVisit.fullyExplored = true;
      console.log('   [页面完成] ' + fingerprint.label + ' 已完全探索');
      this.logToFile('EXPLORE', '页面完成: ' + fingerprint.label);

      // 回退到上一层
      if (this.backStack.length > 1) {
        this.backStack.pop();  // 弹出当前页面
        await this.goBack();
      } else {
        // 已在最顶层，检查是否还有未探索的页面
        const unexplored = this.findUnexploredPages();
        if (unexplored.length === 0) {
          console.log('\n  所有页面已探索完毕！');
          break;
        }
        // 尝试通过导航跳转到未探索页面
        const jumpResult = await this.jumpToUnexploredPage(unexplored[0]);
        if (!jumpResult) {
          console.log('\n  无法跳转到未探索页面，探索结束');
          break;
        }
      }

      this.stepCount++;
    }

    console.log('\n  探索完成！共 ' + this.stepCount + ' 步，覆盖 ' +
      this.visitedPages.size + ' 个页面');
    this.logToFile('EXPLORE', '探索完成: steps=' + this.stepCount +
      ' pages=' + this.visitedPages.size);
  }

  // ─── Phase 1: 页面扫描 ────────────────────────────

  async scanCurrentPage() {
    // 获取当前 Activity
    let currentActivity = 'unknown';
    try {
      const focus = await this.execAdb(['shell', 'dumpsys', 'window', '|', 'grep', 'mCurrentFocus'], 5000);
      const m = focus.match(/\/([\w.]+)}/);
      if (m) currentActivity = m[1];
    } catch (e) {}

    // dump UI
    let uiDump = '';
    try {
      await this.execAdb(['shell', 'uiautomator', 'dump', '/sdcard/ui_explore.xml'], 10000);
      uiDump = await this.execAdb(['shell', 'cat', '/sdcard/ui_explore.xml'], 5000);
    } catch (e) {
      this.errors.push('UI dump 失败: ' + e.message);
      return null;
    }

    if (!uiDump) return null;

    // 解析所有节点（逐属性提取，兼容华为属性乱序）
    const allNodes = [];
    const anyNodeRe = /<node([^>]*?)\/?>/g;
    let nm;
    while ((nm = anyNodeRe.exec(uiDump)) !== null) {
      const attrs = nm[1];
      const textM   = /text="([^"]*)"/.exec(attrs) || ['', ''];
      const clsM    = /class="([^"]*)"/.exec(attrs) || ['', ''];
      const chkM    = /checkable="([^"]*)"/.exec(attrs) || ['', ''];
      const ckdM    = /checked="([^"]*)"/.exec(attrs) || ['', ''];
      const clkM    = /clickable="([^"]*)"/.exec(attrs) || ['', ''];
      const scrM    = /scrollable="([^"]*)"/.exec(attrs) || ['', ''];
      const bndM    = /bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(attrs);
      const ridM    = /resource-id="([^"]*)"/.exec(attrs) || ['', ''];
      const cdM     = /content-desc="([^"]*)"/.exec(attrs) || ['', ''];
      const focusM  = /focused="([^"]*)"/.exec(attrs) || ['', ''];
      const enableM = /enabled="([^"]*)"/.exec(attrs) || ['', ''];
      const selM    = /selected="([^"]*)"/.exec(attrs) || ['', ''];
      if (!bndM) continue;

      const node = {
        text: textM[1],
        cls: clsM[1],
        checkable: chkM[1],
        checked: ckdM[1],
        clickable: clkM[1],
        scrollable: scrM[1],
        bounds: [parseInt(bndM[1]), parseInt(bndM[2]), parseInt(bndM[3]), parseInt(bndM[4])],
        resourceId: ridM[1],
        contentDesc: cdM[1],
        focused: focusM[1],
        enabled: enableM[1],
        selected: selM[1],
        // 元素 ID（用于去重）：resource-id + bounds
        elementId: ridM[1] + '@' + bndM[1] + ',' + bndM[2] + ',' + bndM[3] + ',' + bndM[4],
      };

      // 分类
      node.type = classifyElement(node);

      // 过滤无意义节点（空文字 + 不可交互 + 不是滚动容器）
      const w = node.bounds[2] - node.bounds[0];
      const h = node.bounds[3] - node.bounds[1];
      if (node.type === ELEMENT_TYPES.CONTENT && node.text === '' && node.contentDesc === '' &&
          w < 10 && h < 10) continue;

      allNodes.push(node);
    }

    // 按类型分组
    const navElements = allNodes.filter(n => n.type === ELEMENT_TYPES.NAV);
    const actionElements = allNodes.filter(n => n.type === ELEMENT_TYPES.ACTION);
    const inputElements = allNodes.filter(n => n.type === ELEMENT_TYPES.INPUT);
    const contentElements = allNodes.filter(n => n.type === ELEMENT_TYPES.CONTENT);
    const scrollElements = allNodes.filter(n => n.type === ELEMENT_TYPES.SCROLL);

    // 可见文本
    const visibleTexts = allNodes
      .filter(n => n.text.trim() !== '' || n.contentDesc.trim() !== '')
      .map(n => n.text.trim() || n.contentDesc.trim());

    // 页面指纹
    const fingerprint = new PageFingerprint(
      currentActivity,
      visibleTexts,
      actionElements.length + navElements.length,
      inputElements.length
    );

    // 全局元素采集
    for (const node of allNodes) {
      if (node.text || node.contentDesc || node.clickable === 'true' ||
          node.type !== ELEMENT_TYPES.CONTENT) {
        this.allElements.set(node.elementId, node);
      }
    }

    // 打印当前页面概况
    console.log('   [' + fingerprint.label + ']');
    console.log('     导航: ' + navElements.length + ' | 功能: ' + actionElements.length +
      ' | 输入: ' + inputElements.length + ' | 滚动: ' + scrollElements.length +
      ' | 内容: ' + contentElements.length);

    if (navElements.length > 0) {
      console.log('     导航项: ' + navElements.map(n => '"' + (n.text || n.contentDesc || '图标') + '"').join(', '));
    }
    if (actionElements.length > 0) {
      const actionNames = actionElements.slice(0, 8).map(n => '"' + (n.text || n.contentDesc || '图标') + '"');
      console.log('     功能项: ' + actionNames.join(', ') +
        (actionElements.length > 8 ? ' ...等' + actionElements.length + '个' : ''));
    }

    return {
      fingerprint,
      currentActivity,
      allElements: allNodes,
      navElements,
      actionElements,
      inputElements,
      contentElements,
      scrollElements,
      uiDump,
    };
  }

  // ─── Phase 2: 导航探索 ────────────────────────────

  async exploreNavElements(pageData, pageVisit) {
    const navElems = pageData.navElements || [];
    const unvisitedNav = navElems.filter(n => !pageVisit.interacted.has(n.elementId));

    if (unvisitedNav.length === 0) return null;

    // 优先点击未访问的导航元素
    const target = unvisitedNav[0];
    const cx = Math.floor((target.bounds[0] + target.bounds[2]) / 2);
    const cy = Math.floor((target.bounds[1] + target.bounds[3]) / 2);

    console.log('   [导航] 点击: "' + (target.text || target.contentDesc || '图标') +
      '" at [' + cx + ',' + cy + ']');
    this.logToFile('EXPLORE', '[导航] 点击: ' + (target.text || target.contentDesc) +
      ' at [' + cx + ',' + cy + ']');

    await this.execAdb(['shell', 'input', 'tap', String(cx), String(cy)], 3000);
    await this.sleep(2000);

    pageVisit.interacted.add(target.elementId);
    this.interactedElements.add(target.elementId);

    // 记录探索路径
    this.discoveredPaths.push({
      pathId: 'path-' + this.stepCount,
      startActivity: pageVisit.activity,
      action: 'NAV_CLICK',
      element: target.text || target.contentDesc || 'nav_icon',
      elementType: target.type,
      x: cx,
      y: cy,
    });

    if (this.doScreenshot) {
      await this.captureScreen('nav-' + (target.text || 'icon'));
    }

    return target;
  }

  // ─── Phase 3: 功能探索 ────────────────────────────

  async exploreActionElements(pageData, pageVisit) {
    const actionElems = pageData.actionElements || [];
    const unvisitedActions = actionElems.filter(n => !pageVisit.interacted.has(n.elementId));

    if (unvisitedActions.length === 0) return null;

    // 逐个点击未交互的功能按钮
    const target = unvisitedActions[0];
    const cx = Math.floor((target.bounds[0] + target.bounds[2]) / 2);
    const cy = Math.floor((target.bounds[1] + target.bounds[3]) / 2);

    const elemName = target.text || target.contentDesc || 'icon_btn';
    console.log('   [功能] 点击: "' + elemName + '" at [' + cx + ',' + cy + ']');
    this.logToFile('EXPLORE', '[功能] 点击: ' + elemName + ' at [' + cx + ',' + cy + ']');

    await this.execAdb(['shell', 'input', 'tap', String(cx), String(cy)], 3000);
    await this.sleep(2000);

    pageVisit.interacted.add(target.elementId);
    this.interactedElements.add(target.elementId);

    // 检查点击后是否跳出了当前应用
    const stillInApp = await this.checkStillInApp();
    if (!stillInApp) {
      console.log('   [功能] 点击"' + elemName + '"后离开了应用，回退...');
      this.logToFile('EXPLORE', '离开了应用: ' + elemName);
      await this.goBack();
      return null;  // 不算成功探索
    }

    // 记录探索路径
    this.discoveredPaths.push({
      pathId: 'path-' + this.stepCount,
      startActivity: pageVisit.activity,
      action: 'ACTION_CLICK',
      element: elemName,
      elementType: target.type,
      x: cx,
      y: cy,
    });

    if (this.doScreenshot) {
      await this.captureScreen('action-' + elemName);
    }

    return target;
  }

  // ─── Phase 4: 滚动探索 ────────────────────────────

  async exploreScrollElements(pageData, pageVisit) {
    const scrollElems = pageData.scrollElements || [];

    // 找到还没完全滚动探索的滚动区域
    for (const scrollNode of scrollElems) {
      const scrollKey = scrollNode.elementId;
      const scrollCount = this.scrollDepths.get(scrollKey) || 0;

      // 每个滚动区域最多滚动 5 次
      if (scrollCount >= 5) continue;

      // 判断滚动方向
      const w = scrollNode.bounds[2] - scrollNode.bounds[0];
      const h = scrollNode.bounds[3] - scrollNode.bounds[1];
      const isVertical = h > w;  // 高 > 宽 → 竖向滚动

      console.log('   [滚动] ' + (isVertical ? '竖向' : '横向') +
        ' 滑动区域 (第' + (scrollCount + 1) + '次)');
      this.logToFile('EXPLORE', '[滚动] ' + (isVertical ? '竖向' : '横向') +
        ' scroll=' + scrollCount + ' area=' + scrollNode.cls);

      // 执行滚动
      if (isVertical) {
        // 从中间偏上 → 中间偏下（向下翻页）
        const startY = Math.floor(scrollNode.bounds[1] + h * 0.3);
        const endY = Math.floor(scrollNode.bounds[1] + h * 0.8);
        const centerX = Math.floor((scrollNode.bounds[0] + scrollNode.bounds[2]) / 2);
        await this.execAdb(['shell', 'input', 'swipe',
          String(centerX), String(startY),
          String(centerX), String(endY),
          '300'], 3000);
      } else {
        // 横向: 从左偏 → 右偏
        const startX = Math.floor(scrollNode.bounds[0] + w * 0.3);
        const endX = Math.floor(scrollNode.bounds[0] + w * 0.8);
        const centerY = Math.floor((scrollNode.bounds[1] + scrollNode.bounds[3]) / 2);
        await this.execAdb(['shell', 'input', 'swipe',
          String(startX), String(centerY),
          String(endX), String(centerY),
          '300'], 3000);
      }

      await this.sleep(1500);
      this.scrollDepths.set(scrollKey, scrollCount + 1);

      // 截屏记录滚动后的新内容
      if (this.doScreenshot) {
        await this.captureScreen('scroll-' + scrollCount + '-' + scrollNode.cls.split('.').pop());
      }

      this.discoveredPaths.push({
        pathId: 'path-' + this.stepCount,
        startActivity: pageVisit.activity,
        action: isVertical ? 'SCROLL_DOWN' : 'SCROLL_RIGHT',
        element: scrollNode.cls.split('.').pop(),
        elementType: ELEMENT_TYPES.SCROLL,
      });

      return scrollNode;  // 滚动了 → 重新扫描可能揭示新元素
    }

    return null;  // 所有滚动区域都已翻遍
  }

  // ─── Phase 5: 输入探索 ────────────────────────────

  async exploreInputElements(pageData, pageVisit) {
    const inputElems = pageData.inputElements || [];
    const unvisitedInputs = inputElems.filter(n => !pageVisit.interacted.has(n.elementId));

    if (unvisitedInputs.length === 0) return null;

    const target = unvisitedInputs[0];
    const cx = Math.floor((target.bounds[0] + target.bounds[2]) / 2);
    const cy = Math.floor((target.bounds[1] + target.bounds[3]) / 2);

    // 判断输入类型 → 选择测试数据
    let testValue = TEST_INPUT_DATA.generic;
    const rid = (target.resourceId || '').toLowerCase();
    const cls = (target.cls || '').toLowerCase();
    if (rid.includes('search') || cls.includes('search')) {
      testValue = TEST_INPUT_DATA.search;
      // 打印机应用特殊处理
      if (this.appName.includes('打印') || this.packageName.includes('print')) {
        testValue = TEST_INPUT_DATA.printer_search;
      }
    } else if (rid.includes('password') || cls.includes('password')) {
      testValue = TEST_INPUT_DATA.password;
    } else if (rid.includes('email') || cls.includes('email')) {
      testValue = TEST_INPUT_DATA.email;
    } else if (rid.includes('phone') || cls.includes('phone')) {
      testValue = TEST_INPUT_DATA.phone;
    } else if (rid.includes('url') || cls.includes('url')) {
      testValue = TEST_INPUT_DATA.url;
    }

    const elemName = target.text || target.contentDesc || target.cls.split('.').pop() || 'input';
    console.log('   [输入] 在 "' + elemName + '" 输入: "' + testValue + '"');
    this.logToFile('EXPLORE', '[输入] ' + elemName + ' → "' + testValue + '"');

    // 先点击输入框聚焦
    await this.execAdb(['shell', 'input', 'tap', String(cx), String(cy)], 3000);
    await this.sleep(500);

    // 使用 ADB 输入文字（支持中文需要 adb shell am broadcast 或 ime）
    // ADB input text 不支持中文，改用 ADB keyboard event 逐字符或 adb shell input keyevent
    // 简化方案: 使用 ADB am broadcast 通知 InputConnection
    // 更简单: 直接用 ADB shell input text（仅英文）+ 中文用特殊编码
    // 实际方案: 先输入英文字符，对搜索框一般可以接受英文搜索词
    try {
      await this.execAdb(['shell', 'input', 'text', testValue], 5000);
    } catch (e) {
      // 输入失败 → 尝试另一种方式
      this.logToFile('EXPLORE', '输入失败: ' + e.message);
    }

    await this.sleep(1000);

    // 搜索框 → 输入后按回车触发搜索
    if (rid.includes('search') || cls.includes('search')) {
      console.log('   [输入] 按回车触发搜索');
      await this.execAdb(['shell', 'input', 'keyevent', 'KEYCODE_ENTER'], 3000);
      await this.sleep(2000);
    }

    pageVisit.interacted.add(target.elementId);
    this.interactedElements.add(target.elementId);

    this.discoveredPaths.push({
      pathId: 'path-' + this.stepCount,
      startActivity: pageVisit.activity,
      action: 'INPUT',
      element: elemName,
      elementType: ELEMENT_TYPES.INPUT,
      inputValue: testValue,
    });

    if (this.doScreenshot) {
      await this.captureScreen('input-' + elemName);
    }

    return target;
  }

  // ─── 辅助方法 ──────────────────────────────────────

  /**
   * 检查是否还在当前 App 内
   */
  async checkStillInApp() {
    try {
      const focus = await this.execAdb(['shell', 'dumpsys', 'window', '|', 'grep', 'mCurrentFocus'], 5000);
      return focus.includes(this.packageName);
    } catch (e) {
      return true;  // 无法确认 → 假设还在
    }
  }

  /**
   * 回退到上一层页面
   */
  async goBack() {
    try {
      await this.execAdb(['shell', 'input', 'keyevent', 'KEYCODE_BACK'], 3000);
      await this.sleep(1500);

      // 检查是否回到了桌面
      const stillInApp = await this.checkStillInApp();
      if (!stillInApp) {
        console.log('   Back 回退到了桌面/其他App，重新启动...');
        this.logToFile('EXPLORE', 'Back回到了桌面，重新启动应用');

        // 尝试重新启动应用
        try {
          await this.execAdb(['shell', 'am', 'start', '-n', this.packageName + '/.MainActivity',
            '-a', 'android.intent.action.MAIN',
            '-c', 'android.intent.category.LAUNCHER'], 10000);
          await this.sleep(3000);
        } catch (e) {
          try {
            await this.execAdb(['shell', 'monkey', '-p', this.packageName, '--pct-syskeys', '0', '1'], 15000);
            await this.sleep(3000);
          } catch (e2) {}
        }

        // 清空回退栈
        this.backStack = [];
      }
    } catch (e) {
      this.errors.push('Back 失败: ' + e.message);
    }
  }

  /**
   * 查找未完全探索的页面
   */
  findUnexploredPages() {
    const unexplored = [];
    for (const [hash, visit] of this.visitedPages) {
      if (!visit.fullyExplored) {
        unexplored.push(visit);
      }
    }
    return unexplored;
  }

  /**
   * 尝试跳转到指定页面（通过重新启动 App + 导航路径）
   */
  async jumpToUnexploredPage(targetVisit) {
    console.log('   尝试跳转到未探索页面: ' + targetVisit.fingerprint.label);
    this.logToFile('EXPLORE', '跳转到: ' + targetVisit.fingerprint.label);

    // 简化方案: 重启 App → 自然回到首页 → 从首页导航
    try {
      await this.execAdb(['shell', 'am', 'force-stop', this.packageName], 5000);
      await this.sleep(1000);
      await this.execAdb(['shell', 'am', 'start', '-n', this.packageName + '/.MainActivity',
        '-a', 'android.intent.action.MAIN',
        '-c', 'android.intent.category.LAUNCHER'], 10000);
      await this.sleep(3000);
      this.backStack = [];
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * 延时
   */
  sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  // ─── 报告数据 ──────────────────────────────────────

  /**
   * 生成探索报告数据
   */
  getReport() {
    // 页面覆盖率
    const totalPages = this.visitedPages.size;
    const fullyExploredPages = [...this.visitedPages.values()]
      .filter(v => v.fullyExplored).length;
    const pageCoverage = totalPages > 0
      ? Math.round(fullyExploredPages / totalPages * 100) : 0;

    // 元素覆盖率
    const totalInteractive = this.allElements.size;
    const interacted = this.interactedElements.size;
    const elementCoverage = totalInteractive > 0
      ? Math.round(interacted / totalInteractive * 100) : 0;

    // 每页详情
    const pageDetails = [];
    for (const [hash, visit] of this.visitedPages) {
      const fp = visit.fingerprint;
      const navCount = visit.navElements ? visit.navElements.length : 0;
      const actionCount = visit.actionElements ? visit.actionElements.length : 0;
      const inputCount = visit.inputElements ? visit.inputElements.length : 0;
      const scrollCount = visit.scrollElements ? visit.scrollElements.length : 0;
      const interactedInPage = visit.interacted.size;

      const totalInPage = navCount + actionCount + inputCount;
      const pageElemCoverage = totalInPage > 0
        ? Math.round(interactedInPage / totalInPage * 100) : 100;

      pageDetails.push({
        hash: fp.hash,
        label: fp.label,
        activity: visit.activity,
        visitCount: visit.visitCount,
        fullyExplored: visit.fullyExplored,
        screenshot: visit.screenshot,
        navCount,
        actionCount,
        inputCount,
        scrollCount,
        interactedCount: interactedInPage,
        coverage: pageElemCoverage,
        elements: visit.elements ? visit.elements.filter(n =>
          n.text || n.contentDesc || n.clickable === 'true' || n.type !== ELEMENT_TYPES.CONTENT
        ).map(n => ({
          type: n.type,
          text: n.text || n.contentDesc || '',
          cls: n.cls ? n.cls.split('.').pop() : '',
          clickable: n.clickable,
          resourceId: n.resourceId,
          bounds: n.bounds,
          interacted: visit.interacted.has(n.elementId),
        })) : [],
      });
    }

    // 功能统计（按类型）
    const actionStats = {};
    for (const path of this.discoveredPaths) {
      const key = path.action;
      actionStats[key] = (actionStats[key] || 0) + 1;
    }

    return {
      totalPages,
      fullyExploredPages,
      pageCoverage,
      totalInteractiveElements: totalInteractive,
      interactedElements: interacted,
      elementCoverage,
      totalSteps: this.stepCount,
      activities: Array.from(this.allActivities),
      pageDetails,
      paths: this.discoveredPaths,
      actionStats,
      errors: this.errors,
      duration: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }
}

// ═══════════════════════════════════════════════════
// 导出
// ═══════════════════════════════════════════════════

module.exports = {
  AppExplorer,
  PageFingerprint,
  classifyElement,
  ELEMENT_TYPES,
  NAV_KEYWORDS,
  ACTION_KEYWORDS,
  TEST_INPUT_DATA,
};