/**
 * VTest DeviceProfile — 三平台 × 五元素类型完整策略矩阵
 *
 * 设计原则 (借鉴 Ferret-UI Lite):
 *   1. 不盲猜元素属性 — 每种平台/元素类型有独立的多级策略链
 *   2. 失败降级 — 主策略失败自动尝试备用策略，直到通用视觉托底
 *   3. 验证闭环 — 每次操作后截屏对比确认效果
 *   4. 设备差异是架构 — DeviceProfile 是一等公民，不是补丁
 *
 * 定位策略说明:
 *   uiautomator_xml       → Android 无障碍树 dump + 正则匹配
 *   xcuitest_tree         → iOS XCUITest 无障碍树
 *   hdc_dump              → HarmonyOS hdc dump
 *   standard_checkable    → 标准 Checkable 属性
 *   visual_offset         → 文字节点左侧偏移 (华为 checkbox)
 *   icon_nearby           → 文字旁小图标定位
 *   pixel_diff            → 截屏像素差分 (Flutter)
 *   grid_scan             → 网格盲扫
 *   cdp_selector          → Chrome DevTools Protocol DOM selector
 *   webkit_inspector      → Safari Web Inspector
 *   hdc_webview           → HarmonyOS WebView 调试
 *   text_match            → 纯文本匹配
 *   uiautomator_id        → uiautomator resource-id 定位
 *   visual_grounding      → 视觉模型坐标回归 (Ferret-UI Lite 路线)
 */

const DEVICE_PROFILES = {
  // ═══════════════════════════════════════════════
  // Android 平台
  // ═══════════════════════════════════════════════
  android: {
    huawei: {
      brandPatterns: ['HUAWEI', 'BAL-', 'ALN-', 'NOH-', 'NOP-', 'TAS-', 'LIO-', 'ELS-', 'OCE-'],
      platform: 'android',
      screenDefaults: { width: 1080, height: 1920 },
      dialogFlow: {
        // 华为安装弹窗全流程（含登录+安装完成）
        stages: ['risk_warning', 'security_reminder', 'captcha_puzzle', 'huawei_login', 'install_complete'],
        // 弹窗特征关键词
        stageKeywords: {
          risk_warning: ['风险提示', '继续安装'],
          security_reminder: ['安全提醒', '已了解此应用'],
          captcha_puzzle: ['拼图', '滑动', '拖动', '滑块', '验证'],
          huawei_login: ['华为帐号', '华为账号', '密码', '登录', '输入密码', '验证身份',
                         'HUAWEI ID', '帐号密码', '安全验证'],
          install_complete: ['完成', '完成安装', '打开', 'Done', 'Installation complete']
        },
        postInstallActions: {
          waitForUserInput: ['huawei_login'],      // 需要用户交互的阶段
          autoClickButtons: ['install_complete'],   // 自动点击按钮的阶段
          buttonKeywords: {
            install_complete: ['完成', '完成安装', '打开', 'Done']
          }
        }
      },
      elementStrategies: {
        native: {
          strategies: ['uiautomator_xml'],
          failback: 'visual_grounding'
        },
        custom: {
          // 华为自定义 View (checkbox/button 无标准无障碍属性)
          strategies: ['visual_offset', 'icon_nearby', 'grid_scan'],
          offsets: [-80, -60, -40, -20, 0],
          verifyAfter: true,
          knownIssue: 'uiautomator 不识别 checkable 属性'
        },
        react_native: {
          strategies: ['uiautomator_id', 'text_match'],
          failback: 'visual_grounding'
        },
        flutter: {
          // Flutter 自绘引擎，uiautomator 完全不可见
          strategies: ['pixel_diff', 'grid_scan'],
          failback: 'visual_grounding',
          verifyAfter: true,
          knownIssue: 'Flutter Skia 渲染不创建原生 View'
        },
        h5: {
          strategies: ['cdp_selector', 'text_match'],
          failback: 'visual_grounding',
          cdpConfig: { port: 9222, target: 'localabstract:chrome_devtools_remote' }
        }
      },
      knownIssues: {
        custom_checkbox: 'uiautomator 不识别 checkable 属性，需用 visual_offset 定位',
        dialog_overlay: '半透明弹窗背景导致桌面元素检测干扰，需 isInstallDialog 过滤',
        captcha_puzzle: '安装时可能出现滑块拼图验证，需 swipe 拖动',
        install_user_consent: '弹窗2 checkbox 必须先勾选才能点击继续安装',
        huawei_account_login: '拼图通过后出现华为帐号密码登录界面，需用户手动输入密码',
        install_complete_button: '安装完成后有"完成"按钮需点击，否则自动返回桌面'
      }
    },

    xiaomi: {
      brandPatterns: ['Xiaomi', 'Redmi', 'Mi ', 'M201', 'M200', 'POCO'],
      platform: 'android',
      screenDefaults: { width: 1080, height: 1920 },
      dialogFlow: {
        stages: ['risk_warning', 'install_complete'],  // MIUI 通常只有一层弹窗
        stageKeywords: {
          risk_warning: ['风险提示', '安全提醒', '继续安装'],
          install_complete: ['完成', '完成安装', '打开', 'Done']
        },
        postInstallActions: {
          waitForUserInput: [],
          autoClickButtons: ['install_complete'],
          buttonKeywords: {
            install_complete: ['完成', '完成安装', '打开']
          }
        }
      },
      elementStrategies: {
        native: { strategies: ['uiautomator_xml'] },
        custom: { strategies: ['standard_checkable', 'visual_offset'] },
        react_native: { strategies: ['uiautomator_id', 'text_match'] },
        flutter: { strategies: ['pixel_diff', 'grid_scan'], verifyAfter: true },
        h5: { strategies: ['cdp_selector'] }
      }
    },

    oppo: {
      brandPatterns: ['OPPO', 'CPH', 'RMX', 'PCHM', 'PDHM'],
      platform: 'android',
      elementStrategies: {
        native: { strategies: ['uiautomator_xml'] },
        custom: { strategies: ['standard_checkable', 'visual_offset'] },
        react_native: { strategies: ['uiautomator_id'] },
        flutter: { strategies: ['pixel_diff'], verifyAfter: true },
        h5: { strategies: ['cdp_selector'] }
      }
    },

    vivo: {
      brandPatterns: ['vivo', 'V[0-9]{4}', 'I[0-9]{4}'],
      platform: 'android',
      elementStrategies: {
        native: { strategies: ['uiautomator_xml'] },
        custom: { strategies: ['standard_checkable', 'visual_offset'] },
        react_native: { strategies: ['uiautomator_id'] },
        flutter: { strategies: ['pixel_diff'], verifyAfter: true },
        h5: { strategies: ['cdp_selector'] }
      }
    },

    samsung: {
      brandPatterns: ['Samsung', 'SM-', 'Galaxy'],
      platform: 'android',
      elementStrategies: {
        native: { strategies: ['uiautomator_xml'] },
        custom: { strategies: ['standard_checkable'] },
        flutter: { strategies: ['pixel_diff'], verifyAfter: true },
        h5: { strategies: ['cdp_selector'] }
      }
    },

    universal: {
      brandPatterns: ['*'],
      platform: 'android',
      elementStrategies: {
        native: { strategies: ['uiautomator_xml'] },
        custom: { strategies: ['standard_checkable', 'visual_offset', 'icon_nearby', 'grid_scan'] },
        react_native: { strategies: ['uiautomator_id', 'text_match'] },
        flutter: { strategies: ['pixel_diff', 'grid_scan'], failback: 'visual_grounding', verifyAfter: true },
        h5: { strategies: ['cdp_selector', 'text_match'] }
      }
    }
  },

  // ═══════════════════════════════════════════════
  // iOS 平台
  // ═══════════════════════════════════════════════
  ios: {
    apple: {
      brandPatterns: ['iPhone', 'iPad', 'iPod'],
      platform: 'ios',
      screenDefaults: { width: 1170, height: 2532 },  // iPhone 14 Pro
      toolCommand: 'idevicescreenshot',  // 需要 libimobiledevice
      accessibilityCommand: 'idevicediagnostics',  // 预留
      elementStrategies: {
        native: {
          strategies: ['xcuitest_tree'],
          failback: 'visual_grounding'
        },
        custom: {
          // iOS 自定义控件无 accessibilityLabel
          strategies: ['visual_offset', 'grid_scan'],
          failback: 'visual_grounding',
          verifyAfter: true
        },
        react_native: {
          strategies: ['xcuitest_accessibility', 'text_match'],
          failback: 'visual_grounding'
        },
        flutter: {
          // Flutter on iOS 同样使用自绘引擎
          strategies: ['pixel_diff', 'grid_scan'],
          failback: 'visual_grounding',
          verifyAfter: true
        },
        h5: {
          strategies: ['webkit_inspector'],
          failback: 'visual_grounding'
        }
      },
      knownIssues: {
        flutter_invisible: 'Flutter IOS 不暴露原生无障碍节点',
        lldb_required: 'XCUITest 需要 lldb 调试通道 (需要开发者模式)',
        restricted_sandbox: 'iOS 沙盒限制，部分系统弹窗无法自动化'
      }
    }
  },

  // ═══════════════════════════════════════════════
  // HarmonyOS 平台
  // ═══════════════════════════════════════════════
  harmonyos: {
    huawei: {
      brandPatterns: ['HARMONY', 'ALN-', 'BAL-'],
      platform: 'harmonyos',
      screenDefaults: { width: 1080, height: 1920 },
      toolCommand: 'hdc',  // HarmonyOS Device Connector
      elementStrategies: {
        native: {
          strategies: ['hdc_dump'],
          failback: 'visual_grounding'
        },
        custom: {
          strategies: ['visual_offset', 'grid_scan'],
          failback: 'visual_grounding',
          offsets: [-80, -60, -40, -20, 0],
          verifyAfter: true
        },
        react_native: {
          strategies: ['hdc_dump', 'text_match'],
          failback: 'visual_grounding'
        },
        flutter: {
          strategies: ['pixel_diff', 'grid_scan'],
          failback: 'visual_grounding',
          verifyAfter: true
        },
        h5: {
          strategies: ['hdc_webview'],
          failback: 'visual_grounding'
        }
      },
      knownIssues: {
        hdc_immature: 'hdc 工具链尚未成熟，API 可能不稳定',
        webview_debug: 'HarmonyOS WebView 调试通道待验证',
        arkui_dump: 'ArkUI dump 格式可能与 uiautomator 不同'
      }
    }
  }
};

/**
 * 解析 ADB `getprop ro.product.model` 输出，返回品牌和型号
 * 支持华为序列号前缀映射（如 BAL-AL80 → 华为 P50 Pocket）
 */
const MODEL_BRAND_MAP = {
  'BAL-AL': { brand: 'huawei', model: 'P50Pocket', platform: 'android' },
  'BAL-AN': { brand: 'huawei', model: 'P50Pocket_5G', platform: 'android' },
  'ALN-AL': { brand: 'huawei', model: 'Mate60Pro', platform: 'android' },
  'NOH-AN': { brand: 'huawei', model: 'Mate40Pro', platform: 'android' },
  'NOP-AN': { brand: 'huawei', model: 'Mate40Pro+', platform: 'android' },
  'TAS-AN': { brand: 'huawei', model: 'P40Pro', platform: 'android' },
  'ELS-AN': { brand: 'huawei', model: 'P40Pro', platform: 'android' },
  'LIO-AN': { brand: 'huawei', model: 'Mate30Pro', platform: 'android' },
  'OCE-AN': { brand: 'huawei', model: 'Nova7Pro', platform: 'android' },
};

/**
 * 根据设备信息识别 DeviceProfile
 *
 * @param {Object} deviceInfo - { model: string, platform?: string }
 * @returns {Object} { brand, model, platform, profile }
 */
function detectDeviceProfile(deviceInfo) {
  const { model: rawModel, platform: givenPlatform } = deviceInfo;
  const model = (rawModel || '').trim();

  // 1. 精确型号匹配
  for (const [prefix, info] of Object.entries(MODEL_BRAND_MAP)) {
    if (model.startsWith(prefix)) {
      const platform = givenPlatform || info.platform;
      const profiles = DEVICE_PROFILES[platform];
      if (!profiles) break;
      const profile = profiles[info.brand];
      if (profile) {
        return { brand: info.brand, model: info.model, platform, profile };
      }
    }
  }

  // 2. 品牌前缀匹配（遍历所有品牌的正则）
  const platform = givenPlatform || 'android';
  const profiles = DEVICE_PROFILES[platform];
  if (!profiles) {
    // 未知平台 → 使用 android universal
    return {
      brand: 'unknown',
      model: model,
      platform: 'android',
      profile: DEVICE_PROFILES['android']['universal']
    };
  }

  for (const [brand, profile] of Object.entries(profiles)) {
    if (brand === 'universal') continue;
    const patterns = profile.brandPatterns || [];
    for (const pattern of patterns) {
      try {
        if (new RegExp(pattern, 'i').test(model)) {
          return { brand, model, platform, profile };
        }
      } catch (e) { /* 跳过无效正则 */ }
    }
  }

  // 3. 通用兜底
  return {
    brand: 'unknown',
    model: model,
    platform,
    profile: profiles['universal'] || DEVICE_PROFILES['android']['universal']
  };
}

/**
 * 推断 UI 元素类型
 * 基于 uiautomator dump 中节点的 class 名称模式
 *
 * @param {Object} node - 解析后的 XML 节点 { cls, text, checkable, resourceId, ... }
 * @param {Object} profile - DeviceProfile
 * @returns {string} 元素类型: 'native' | 'custom' | 'react_native' | 'flutter' | 'h5'
 */
function inferElementType(node, profile) {
  const cls = (node.cls || '').toLowerCase();
  const rid = (node.resourceId || '').toLowerCase();

  // Flutter: 所有节点 class 通常是 android.view.View (无具体类型)
  if (cls === 'android.view.view' && !node.checkable && !rid) {
    // 进一步判断: 如果整棵树都是 View，很可能是 Flutter
    return 'flutter';
  }

  // React Native: resource-id 通常有特定前缀
  if (rid.includes('rn_') || rid.includes('react_') || cls.includes('react')) {
    return 'react_native';
  }

  // H5/WebView: class 通常是 android.webkit.WebView
  if (cls.includes('webview') || cls.includes('webkit')) {
    return 'h5';
  }

  // Custom View: 标准 View 但无 accessibility
  if (cls.includes('view') && !node.checkable && !node.clickable && !rid) {
    if (node.text && node.text.length > 0) {
      return 'custom';  // 有文字无无障碍属性 → 可能是华为自定义控件
    }
  }

  // 默认 native
  if (cls.includes('button') || cls.includes('textview') || cls.includes('edittext') ||
      cls.includes('imageview') || cls.includes('checkbox') || cls.includes('radiobutton') ||
      cls.includes('switch')) {
    return 'native';
  }

  return 'custom';  // 保守策略: 未识别 = custom (走多策略探测)
}

/**
 * 获取元素类型的定位策略链
 *
 * @param {Object} profile - DeviceProfile
 * @param {string} elementType - 元素类型
 * @returns {Object} { strategies: string[], verifyAfter: boolean, offsets: number[], ... }
 */
function getStrategyChain(profile, elementType) {
  const strategies = profile?.elementStrategies?.[elementType];
  if (!strategies) {
    // 未知类型 → 全策略链
    return {
      strategies: ['uiautomator_xml', 'standard_checkable', 'visual_offset', 'icon_nearby', 'grid_scan'],
      verifyAfter: true,
      failback: 'visual_grounding'
    };
  }
  return strategies;
}

module.exports = {
  DEVICE_PROFILES,
  MODEL_BRAND_MAP,
  detectDeviceProfile,
  inferElementType,
  getStrategyChain
};