# VTest MVP 可量化验收标准定义文档

**文档版本**: v1.0  
**创建日期**: 2026-06-07  
**负责人**: QA-Lead  
**审核状态**: 待审核

---

## 目录

1. [用户故事量化验收标准](#1-用户故事量化验收标准)
2. [测试类型与优先级矩阵](#2-测试类型与优先级矩阵)
3. [5S评审检查清单](#3-5s评审检查清单)
4. [MVP验收测试方案](#4-mvp验收测试方案)
5. [附录：测试数据准备](#5-附录测试数据准备)

---

## 1. 用户故事量化验收标准

### US-01: APK上传与解析

#### 基本信息
- **故事描述**: 用户上传APK文件，系统自动解析并提取应用基本信息
- **优先级**: P0（核心功能）

#### 量化验收标准

**输入条件**
- 输入格式：Android APK文件（.apk）
- 文件大小：≤ 500MB
- 支持的Android版本：API 21+ (Android 5.0+)
- 示例文件：`VTestDemo_v1.0.apk` (15MB, 12个Activity)

**操作步骤**
1. 点击"上传APK"按钮
2. 选择本地APK文件
3. 等待系统解析完成
4. 查看解析结果页面

**预期输出**
```json
{
  "app_name": "VTestDemo",
  "package_name": "com.example.vtestdemo",
  "version": "1.0",
  "version_code": 1,
  "min_sdk": 21,
  "target_sdk": 34,
  "activities": [
    "com.example.vtestdemo.MainActivity",
    "com.example.vtestdemo.LoginActivity",
    ...
  ],
  "permissions": [...],
  "file_size": 15728640,
  "md5": "abc123...",
  "parse_status": "success"
}
```

**量化指标**
| 指标 | 目标值 | 测量方法 |
|------|--------|----------|
| 解析成功率 | ≥ 95% | 成功解析APK数 / 总上传APK数 |
| 解析时间 | ≤ 60秒 | 从上传完成到解析结果展示的时间 |
| Activity识别准确率 | ≥ 98% | 正确识别的Activity数 / APK实际Activity总数 |
| 文件信息完整性 | 100% | 必填字段（app_name, package_name, version）完整性检查 |
| 错误提示准确率 | 100% | 对损坏/不支持的APK给出明确错误提示 |

**自动化验证方法**
```python
# 伪代码示例
def test_apk_upload_parse():
    # 准备10个正常APK，5个异常APK
    test_apks = prepare_test_apks()
    
    for apk in test_apks:
        result = upload_and_parse(apk)
        
        # 验证解析成功率
        assert result.status == "success"
        
        # 验证解析时间
        assert result.parse_time <= 60
        
        # 验证输出格式
        assert validate_json_schema(result.output)
        
        # 验证Activity识别准确性（通过apktool反编译对比）
        actual_activities = extract_activities_by_apktool(apk)
        assert set(result.activities) == set(actual_activities)
```

---

### US-02: AI探索与路径生成

#### 基本信息
- **故事描述**: 系统使用AI自动探索APK，生成可执行的测试路径
- **优先级**: P0（核心功能）

#### 量化验收标准

**输入条件**
- 输入：已成功解析的APK文件
- APK复杂度分类：
  - 简单：≤ 10个Activity
  - 中等：11-20个Activity
  - 复杂：> 20个Activity
- 示例：VTestDemo (12个Activity)

**操作步骤**
1. 在APK解析完成后，点击"开始AI探索"按钮
2. 系统自动启动Android模拟器/连接真机
3. AI算法自动探索应用
4. 探索完成后生成路径报告

**预期输出**
```json
// exploration_paths.json
{
  "app_package": "com.example.vtestdemo",
  "exploration_start": "2026-06-07T10:00:00Z",
  "exploration_end": "2026-06-07T10:25:30Z",
  "total_paths": 45,
  "paths": [
    {
      "path_id": "path_001",
      "start_activity": "MainActivity",
      "end_activity": "SettingsActivity",
      "steps": [
        {"action": "click", "element": "button_login", "x": 540, "y": 1200},
        {"action": "input", "element": "edit_username", "text": "testuser"},
        ...
      ],
      "coverage": ["MainActivity", "LoginActivity", "HomeActivity"],
      "reproducible": true
    },
    ...
  ],
  "coverage_summary": {
    "total_activities": 12,
    "explored_activities": 11,
    "coverage_rate": 0.9167
  }
}
```

**量化指标**
| 指标 | 简单App | 中等App | 复杂App | 测量方法 |
|------|---------|---------|---------|----------|
| 路径覆盖率 | ≥ 95% | ≥ 85% | ≥ 70% | 已探索Activity数 / APK反编译得到的Activity总数 |
| 探索时间 | ≤ 15分钟 | ≤ 30分钟 | ≤ 60分钟 | 从点击"开始探索"到生成报告的时间 |
| 路径总数 | ≥ 20条 | ≥ 40条 | ≥ 60条 | exploration_paths.json中的paths数组长度 |
| 误报率 | ≤ 3% | ≤ 5% | ≤ 8% | 无效路径（无法复现）占比 |
| 路径多样性 | ≥ 80% | ≥ 75% | ≥ 70% | 独特路径数 / 总路径数（去重后） |
| 平均路径长度 | 3-8步 | 4-10步 | 5-15步 | 每条路径的步数统计 |

**自动化验证方法**
```python
def test_ai_exploration():
    # 准备3个复杂度的测试APK
    test_apps = [
        ("simple_app.apk", 8, 60),   # (文件, Activity数, 期望覆盖率%)
        ("medium_app.apk", 15, 85),
        ("complex_app.apk", 35, 70)
    ]
    
    for apk, activity_count, min_coverage in test_apps:
        result = run_ai_exploration(apk)
        
        # 验证覆盖率
        coverage = result.coverage_summary.explored_activities / activity_count
        assert coverage >= min_coverage / 100
        
        # 验证探索时间
        exploration_time = result.exploration_end - result.exploration_start
        max_time = 15 if activity_count <= 10 else (30 if activity_count <= 20 else 60)
        assert exploration_time <= max_time * 60  # 转换为秒
        
        # 验证误报率：随机抽样10条路径进行复现
        sample_paths = random.sample(result.paths, 10)
        reproducible_count = sum(1 for p in sample_paths if reproduce_path(p))
        false_positive_rate = 1 - (reproducible_count / 10)
        assert false_positive_rate <= 0.05  # ≤ 5%
        
        # 验证路径多样性
        unique_paths = len(set(p.steps for p in result.paths))
        diversity = unique_paths / len(result.paths)
        assert diversity >= 0.75  # ≥ 75%
```

**特殊场景测试**
- **网络异常**: 探索过程中断开网络，验证能否正确处理
- **App崩溃**: 探索过程中App崩溃，验证能否自动恢复并继续
- **设备断开**: 测试设备断开重连，验证鲁棒性

---

### US-03: 测试用例生成

#### 基本信息
- **故事描述**: 根据AI探索的路径，自动生成可执行的测试用例
- **优先级**: P0（核心功能）

#### 量化验收标准

**输入条件**
- 输入：exploration_paths.json（来自US-02的输出）
- 路径数量：≥ 20条
- 路径格式：符合US-02定义的JSON Schema

**操作步骤**
1. AI探索完成后，自动触发测试用例生成
2. 系统分析每条路径，提取测试步骤
3. 生成测试用例文件（支持多种格式）
4. 展示测试用例列表

**预期输出**
```json
// test_cases.json
{
  "generated_at": "2026-06-07T10:30:00Z",
  "total_cases": 45,
  "format": "pytest",
  "cases": [
    {
      "case_id": "TC_001",
      "title": "验证用户登录功能",
      "priority": "P0",
      "preconditions": "App已启动，未登录状态",
      "steps": [
        {"step": 1, "action": "点击登录按钮", "expected": "跳转到登录页面"},
        {"step": 2, "action": "输入用户名'testuser'", "expected": "用户名输入框显示'testuser'"},
        {"step": 3, "action": "输入密码'123456'", "expected": "密码输入框显示掩码"},
        {"step": 4, "action": "点击提交按钮", "expected": "登录成功，跳转到首页"}
      ],
      "expected_result": "登录成功，用户信息正确显示",
      "postconditions": "用户已登录状态",
      "tags": ["login", "smoke"],
      "automation_script": "test_login_success.py"
    },
    ...
  ]
}
```

**量化指标**
| 指标 | 目标值 | 测量方法 |
|------|--------|----------|
| 用例生成成功率 | ≥ 98% | 成功生成的用例数 / 输入路径数 |
| 用例格式正确性 | 100% | 生成的用例符合目标格式（pytest/TestNG等）的语法检查 |
| 步骤完整性 | ≥ 95% | 包含完整preconditions、steps、expected_result的用例占比 |
| 优先级分配准确性 | ≥ 85% | 人工评审确认的合理优先级分配占比 |
| 自动化脚本可执行情况 | ≥ 90% | 生成的自动化脚本能够成功解析并执行的占比 |
| 生成时间 | ≤ 5分钟 | 从路径输入到用例生成完成的时间 |

**自动化验证方法**
```python
def test_testcase_generation():
    # 准备测试数据
    exploration_result = load_json("exploration_paths.json")
    
    # 执行用例生成
    test_cases = generate_test_cases(exploration_result)
    
    # 验证生成成功率
    assert len(test_cases.cases) >= len(exploration_result.paths) * 0.98
    
    # 验证格式正确性：尝试用pytest编译
    for case in test_cases.cases:
        script_path = case.automation_script
        result = subprocess.run(["python", "-m", "py_compile", script_path])
        assert result.returncode == 0
    
    # 验证步骤完整性
    complete_cases = sum(1 for c in test_cases.cases 
                        if c.preconditions and c.steps and c.expected_result)
    completeness_rate = complete_cases / len(test_cases.cases)
    assert completeness_rate >= 0.95
    
    # 验证生成时间
    start_time = time.time()
    generate_test_cases(exploration_result)
    generation_time = time.time() - start_time
    assert generation_time <= 300  # ≤ 5分钟
```

---

### US-04: 测试执行与结果收集

#### 基本信息
- **故事描述**: 执行生成的测试用例，收集执行结果和日志
- **优先级**: P0（核心功能）

#### 量化验收标准

**输入条件**
- 输入：test_cases.json（来自US-03的输出）
- 测试设备：Android 8.0+ 真机或模拟器
- ADB连接：设备已通过ADB连接并授权

**操作步骤**
1. 选择要执行的测试用例（支持全选、按优先级筛选）
2. 配置测试设备（选择已连接的设备）
3. 点击"开始执行"按钮
4. 实时查看执行进度和日志
5. 执行完成后查看测试报告

**预期输出**
```json
// execution_report.json
{
  "execution_id": "exec_20260607_103000",
  "start_time": "2026-06-07T10:30:00Z",
  "end_time": "2026-06-07T10:45:00Z",
  "device": {
    "model": "Pixel 6",
    "android_version": "12",
    "api_level": 31
  },
  "summary": {
    "total": 45,
    "passed": 42,
    "failed": 3,
    "blocked": 0,
    "pass_rate": 0.9333
  },
  "results": [
    {
      "case_id": "TC_001",
      "status": "passed",
      "start_time": "2026-06-07T10:30:05Z",
      "end_time": "2026-06-07T10:30:15Z",
      "duration": 10.5,
      "steps": [
        {"step": 1, "status": "passed", "screenshot": "screenshot_001_1.png"},
        {"step": 2, "status": "passed", "screenshot": "screenshot_001_2.png"},
        ...
      ],
      "logs": "logcat_TC_001.txt"
    },
    ...
  ],
  "artifacts": {
    "screenshots": 180,
    "logs": 45,
    "videos": 1
  }
}
```

**量化指标**
| 指标 | 目标值 | 测量方法 |
|------|--------|----------|
| 执行成功率 | ≥ 95% | 成功执行的用例数 / 总用例数（排除blocked） |
| 结果准确性 | ≥ 98% | 人工验证的执行结果与系统记录一致占比 |
| 执行速度 | ≤ 20秒/用例 | 总执行时间 / 用例数 |
| 日志完整性 | 100% | 每个用例都有对应的logcat日志 |
| 截图覆盖率 | 100% | 每个步骤都有截图（可选择是否开启） |
| 崩溃捕获率 | 100% | App执行过程中发生崩溃时，能被正确记录为failed |
| 超时处理准确率 | 100% | 执行时间超过设定超时时间的用例被正确标记为blocked |

**自动化验证方法**
```python
def test_execution_and_result_collection():
    # 准备测试数据
    test_cases = load_json("test_cases.json")
    device = connect_device()
    
    # 执行测试
    report = execute_tests(test_cases, device)
    
    # 验证执行成功率
    success_rate = report.summary.passed / report.summary.total
    assert success_rate >= 0.95
    
    # 验证结果准确性：人工抽查10%的用例
    sample_cases = random.sample(report.results, int(len(report.results) * 0.1))
    for result in sample_cases:
        manual_result = manual_execute(result.case_id)
        assert manual_result.status == result.status
    
    # 验证执行速度
    avg_execution_time = report.summary.total_duration / report.summary.total
    assert avg_execution_time <= 20  # ≤ 20秒/用例
    
    # 验证日志完整性
    for result in report.results:
        assert os.path.exists(result.logs)
        assert os.path.getsize(result.logs) > 0
    
    # 验证截图覆盖率
    if enable_screenshot:
        total_steps = sum(len(r.steps) for r in report.results)
        screenshots = sum(1 for r in report.results for s in r.steps if s.screenshot)
        assert screenshots == total_steps
```

---

### US-05: 报告生成与导出

#### 基本信息
- **故事描述**: 生成可视化测试报告，支持多种格式导出
- **优先级**: P1（重要功能）

#### 量化验收标准

**输入条件**
- 输入：execution_report.json（来自US-04的输出）
- 报告格式：HTML、PDF、JUnit XML

**操作步骤**
1. 测试执行完成后，自动触发报告生成
2. 系统生成可视化报告（图表、统计等）
3. 用户可以选择导出格式
4. 下载报告文件

**预期输出**
```
report_output/
├── index.html              # 主报告文件
├── assets/
│   ├── style.css
│   ├── chart.js
│   └── screenshots/        # 截图文件夹
├── report.pdf              # PDF版本
├── junit.xml               # JUnit格式（用于CI集成）
└── raw_data.json           # 原始数据（用于自定义分析）
```

**HTML报告内容**
- 执行摘要（总用例数、通过率、失败率）
- 可视化图表（饼图、趋势图、失败分布）
- 详细用例结果（可展开查看每个步骤）
- 截图画廊（支持放大查看）
- 日志查看器（带搜索和过滤）
- 失败用例的堆栈跟踪

**量化指标**
| 指标 | 目标值 | 测量方法 |
|------|--------|----------|
| 报告生成时间 | ≤ 30秒 | 从执行完成到报告可用的时长 |
| HTML报告加载时间 | ≤ 3秒 | 浏览器打开index.html到完全渲染完成 |
| PDF生成成功率 | ≥ 99% | 成功生成PDF的报告数 / 总报告数 |
| 报告文件大小 | ≤ 50MB | 包含所有截图和日志的报告文件大小 |
| 截图清晰度 | 原始分辨率 | 截图分辨率与设备屏幕分辨率一致 |
| 导出格式兼容性 | 100% | 导出的PDF能在主流PDF阅读器打开；JUnit XML能被Jenkins解析 |
| 报告数据准确性 | 100% | 报告中的统计数据与execution_report.json完全一致 |

**自动化验证方法**
```python
def test_report_generation_and_export():
    # 准备测试数据
    execution_report = load_json("execution_report.json")
    
    # 生成报告
    start_time = time.time()
    report_path = generate_report(execution_report, format="html")
    generation_time = time.time() - start_time
    assert generation_time <= 30  # ≤ 30秒
    
    # 验证HTML报告加载时间
    load_time = measure_page_load_time(report_path)
    assert load_time <= 3  # ≤ 3秒
    
    # 验证报告内容准确性
    html_data = parse_html_report(report_path)
    assert html_data.summary.total == execution_report.summary.total
    assert html_data.summary.passed == execution_report.summary.passed
    assert abs(html_data.summary.pass_rate - execution_report.summary.pass_rate) < 0.001
    
    # 验证PDF导出
    pdf_path = export_report(report_path, format="pdf")
    assert os.path.exists(pdf_path)
    assert os.path.getsize(pdf_path) <= 50 * 1024 * 1024  # ≤ 50MB
    assert validate_pdf(pdf_path)  # 检查PDF是否能正常打开
    
    # 验证JUnit XML导出
    xml_path = export_report(report_path, format="junit")
    assert validate_junit_xml(xml_path)  # 检查XML格式是否符合JUnit标准
    
    # 验证截图清晰度
    screenshots = glob.glob(os.path.join(report_path, "assets/screenshots/*.png"))
    for screenshot in screenshots:
        img = Image.open(screenshot)
        assert img.size[0] >= 1080  # 至少1080p宽度
```

---

### US-06: 缺陷追踪集成

#### 基本信息
- **故事描述**: 将测试失败用例自动创建为缺陷报告，集成到缺陷管理系统
- **优先级**: P2（增强功能）

#### 量化验收标准

**输入条件**
- 输入：execution_report.json中的失败用例
- 支持的缺陷管理系统：Jira、GitHub Issues、Bugzilla
- API凭据：已配置目标系统的API访问权限

**操作步骤**
1. 测试执行完成，查看失败用例
2. 选择"创建缺陷"按钮
3. 系统自动填充缺陷信息（标题、描述、复现步骤、截图等）
4. 用户确认并提交到缺陷管理系统
5. 返回缺陷ID，关联到测试用例

**预期输出**
```json
// defect_report.json
{
  "defect_id": "JIRA-1234",
  "source": "jira",
  "case_id": "TC_015",
  "created_at": "2026-06-07T10:50:00Z",
  "title": "[VTest Auto] 登录功能失败 - TC_015",
  "description": "## 问题描述\n测试用例TC_015执行失败...\n\n## 复现步骤\n1. 启动App\n2. 点击登录按钮...\n\n## 实际结果\n点击登录按钮后App崩溃\n\n## 预期结果\n跳转到登录页面\n\n## 环境信息\n- 设备：Pixel 6\n- Android版本：12\n- App版本：1.0",
  "priority": "High",
  "severity": "Major",
  "attachments": [
    "screenshot_TC_015_step3.png",
    "logcat_TC_015.txt"
  ],
  "status": "Open",
  "assignee": "未分配",
  "tags": ["vtest-auto", "login", "crash"]
}
```

**量化指标**
| 指标 | 目标值 | 测量方法 |
|------|--------|----------|
| 缺陷创建成功率 | ≥ 95% | 成功创建的缺陷数 / 尝试创建的缺陷数 |
| 信息完整性 | ≥ 90% | 包含完整复现步骤、环境信息、截图的缺陷占比 |
| 重复缺陷检测准确率 | ≥ 85% | 正确识别重复缺陷（已存在相似缺陷）的占比 |
| 创建时间 | ≤ 10秒 | 从点击"创建缺陷"到返回defect_id的时间 |
| API调用成功率 | ≥ 99% | 成功调用缺陷管理系统API的次数 / 总调用次数 |
| 附件上传成功率 | ≥ 98% | 成功上传附件（截图、日志）的缺陷占比 |

**自动化验证方法**
```python
def test_defect_tracking_integration():
    # 配置测试环境
    configure_jira_api_credentials()
    
    # 准备测试数据：10个失败用例
    failed_cases = load_failed_cases(10)
    
    for case in failed_cases:
        # 创建缺陷
        start_time = time.time()
        defect = create_defect(case, system="jira")
        creation_time = time.time() - start_time
        
        # 验证创建成功率
        assert defect is not None
        assert defect.defect_id.startswith("JIRA-")
        
        # 验证创建时间
        assert creation_time <= 10  # ≤ 10秒
        
        # 验证信息完整性
        assert defect.title != ""
        assert "复现步骤" in defect.description
        assert "环境信息" in defect.description
        assert len(defect.attachments) >= 2  # 至少包含截图和日志
        
        # 验证API调用成功率：检查Jira中是否存在该缺陷
        jira_issue = fetch_from_jira(defect.defect_id)
        assert jira_issue is not None
        assert jira_issue.status_code == 200
        
        # 验证附件上传成功率
        for attachment in defect.attachments:
            assert os.path.exists(attachment)
            assert os.path.getsize(attachment) > 0
    
    # 验证重复缺陷检测：尝试创建两个相同的缺陷
    defect1 = create_defect(failed_cases[0], system="jira")
    defect2 = create_defect(failed_cases[0], system="jira")  # 应该检测到重复
    assert defect2.is_duplicate == True
    assert defect2.linked_defect_id == defect1.defect_id
```

---

## 2. 测试类型与优先级矩阵

### 2.1 功能测试（Functional Testing）

#### 优先级定义
- **P0**: 核心功能，必须通过，否则无法发布
- **P1**: 重要功能，建议通过，可延期修复
- **P2**: 增强功能，可后续迭代

#### 功能测试覆盖矩阵

| 功能模块 | 测试点 | 优先级 | 自动化覆盖 | 测试方法 |
|----------|--------|--------|------------|----------|
| **APK上传与解析** |  |  |  |  |
|  | 上传有效APK | P0 | ✓ | 单元测试+集成测试 |
|  | 上传无效文件（非APK） | P0 | ✓ | 单元测试 |
|  | 上传损坏的APK | P0 | ✓ | 单元测试 |
|  | 解析大型APK（>100MB） | P1 | ✓ | 性能测试 |
|  | 解析进度显示 | P2 | ✓ | E2E测试 |
| **AI探索** |  |  |  |  |
|  | 启动探索 | P0 | ✓ | E2E测试 |
|  | 探索过程实时监控 | P1 | ✓ | E2E测试 |
|  | 探索暂停/继续/停止 | P1 | ✓ | E2E测试 |
|  | 探索路径生成 | P0 | ✓ | 集成测试 |
|  | 探索覆盖率统计 | P0 | ✓ | 集成测试 |
|  | 探索时间控制（超时） | P1 | ✓ | 单元测试 |
| **测试用例生成** |  |  |  |  |
|  | 从路径生成用例 | P0 | ✓ | 单元测试+集成测试 |
|  | 用例格式验证 | P0 | ✓ | 单元测试 |
|  | 用例优先级分配 | P1 | ✗ | 人工评审 |
|  | 用例去重 | P1 | ✓ | 单元测试 |
|  | 自动化脚本生成 | P0 | ✓ | 集成测试 |
| **测试执行** |  |  |  |  |
|  | 执行单个用例 | P0 | ✓ | E2E测试 |
|  | 批量执行用例 | P0 | ✓ | E2E测试 |
|  | 执行失败重试 | P1 | ✓ | E2E测试 |
|  | 执行超时处理 | P1 | ✓ | E2E测试 |
|  | 设备断开重连 | P1 | ✓ | E2E测试 |
|  | 并行执行（多设备） | P2 | ✗ | E2E测试 |
| **报告生成** |  |  |  |  |
|  | HTML报告生成 | P0 | ✓ | 集成测试 |
|  | PDF报告导出 | P1 | ✓ | 集成测试 |
|  | JUnit XML导出 | P1 | ✓ | 集成测试 |
|  | 报告数据准确性 | P0 | ✓ | 集成测试 |
|  | 截图嵌入报告 | P1 | ✓ | 集成测试 |
| **缺陷追踪** |  |  |  |  |
|  | 创建Jira缺陷 | P2 | ✓ | 集成测试（Mock） |
|  | 创建GitHub Issue | P2 | ✓ | 集成测试（Mock） |
|  | 重复缺陷检测 | P2 | ✓ | 单元测试 |
|  | 附件上传 | P2 | ✓ | 集成测试 |

#### 自动化测试代码示例

```python
# 示例：APK上传与解析的功能测试
import pytest
from vtest.core.apk_parser import APKParser

class TestAPKUploadAndParse:
    """APK上传与解析功能测试"""
    
    @pytest.fixture
    def parser(self):
        return APKParser()
    
    @pytest.fixture
    def valid_apk(self):
        return "tests/fixtures/valid_app.apk"
    
    @pytest.fixture
    def invalid_file(self):
        return "tests/fixtures/not_an_apk.txt"
    
    @pytest.fixture
    def corrupted_apk(self):
        return "tests/fixtures/corrupted.apk"
    
    def test_upload_valid_apk(self, parser, valid_apk):
        """测试上传有效的APK文件 - P0"""
        result = parser.parse(valid_apk)
        
        assert result.status == "success"
        assert result.app_name != ""
        assert result.package_name != ""
        assert len(result.activities) > 0
        assert result.parse_time <= 60
    
    def test_upload_invalid_file(self, parser, invalid_file):
        """测试上传无效文件 - P0"""
        with pytest.raises(InvalidAPKError) as exc_info:
            parser.parse(invalid_file)
        
        assert "Not a valid APK file" in str(exc_info.value)
    
    def test_upload_corrupted_apk(self, parser, corrupted_apk):
        """测试上传损坏的APK - P0"""
        with pytest.raises(APKParsingError) as exc_info:
            parser.parse(corrupted_apk)
        
        assert "APK file is corrupted" in str(exc_info.value)
    
    @pytest.mark.slow
    def test_parse_large_apk(self, parser):
        """测试解析大型APK - P1"""
        large_apk = "tests/fixtures/large_app.apk"  # 200MB
        
        import time
        start = time.time()
        result = parser.parse(large_apk)
        parse_time = time.time() - start
        
        assert result.status == "success"
        assert parse_time <= 180  # ≤ 3分钟
    
    def test_parse_progress_display(self, parser, valid_apk):
        """测试解析进度显示 - P2"""
        progress_updates = []
        
        def progress_callback(progress):
            progress_updates.append(progress)
        
        parser.parse(valid_apk, progress_callback=progress_callback)
        
        # 验证进度从0%到100%
        assert len(progress_updates) > 0
        assert progress_updates[0] == 0
        assert progress_updates[-1] == 100
```

---

### 2.2 性能测试（Performance Testing）

#### 性能指标定义

| 指标类型 | 指标名称 | 测量方法 | P0目标 | P1目标 | P2目标 |
|----------|----------|----------|--------|--------|--------|
| **启动性能** | 应用启动时间 | 从双击图标到主界面可见 | ≤ 3秒 | ≤ 5秒 | ≤ 8秒 |
|  | APK上传初始化时间 | 从选择文件到开始上传 | ≤ 1秒 | ≤ 2秒 | ≤ 3秒 |
|  | AI探索启动时间 | 从点击按钮到开始探索 | ≤ 5秒 | ≤ 10秒 | ≤ 15秒 |
| **处理性能** | APK解析时间 | 见US-01量化指标 | ≤ 60秒 | ≤ 120秒 | ≤ 180秒 |
|  | AI探索时间 | 见US-02量化指标 | 见US-02 | 见US-02 | 见US-02 |
|  | 测试用例生成时间 | 见US-03量化指标 | ≤ 5分钟 | ≤ 10分钟 | ≤ 15分钟 |
|  | 单用例执行时间 | 见US-04量化指标 | ≤ 20秒 | ≤ 30秒 | ≤ 60秒 |
|  | 报告生成时间 | 见US-05量化指标 | ≤ 30秒 | ≤ 60秒 | ≤ 120秒 |
| **资源消耗** | CPU使用率（峰值） | 任务执行期间的CPU占用 | ≤ 80% | ≤ 90% | - |
|  | 内存使用量（峰值） | 任务执行期间的内存占用 | ≤ 2GB | ≤ 4GB | ≤ 8GB |
|  | 磁盘I/O | 每秒读写字节数 | ≤ 100MB/s | ≤ 200MB/s | - |
|  | 网络带宽 | 下载APK、上传报告等 | ≤ 10MB/s | ≤ 50MB/s | - |
| **并发性能** | 最大并发探索任务数 | 同时运行的AI探索任务 | 1 | 3 | 5 |
|  | 最大并发执行设备数 | 同时连接的测试设备 | 1 | 3 | 10 |

#### 性能测试代码示例

```python
# 示例：性能测试
import pytest
import time
import psutil
from vtest.performance.monitor import PerformanceMonitor

class TestPerformance:
    """性能测试"""
    
    @pytest.fixture
    def monitor(self):
        return PerformanceMonitor()
    
    def test_apk_parse_time(self, monitor):
        """测试APK解析时间 - P0"""
        apk = "tests/fixtures/medium_app.apk"  # 15MB, 12个Activity
        
        monitor.start()
        result = parse_apk(apk)
        metrics = monitor.stop()
        
        # 验证解析时间
        assert result.parse_time <= 60  # ≤ 60秒
        
        # 验证资源消耗
        assert metrics.cpu_peak <= 80  # ≤ 80%
        assert metrics.memory_peak <= 2 * 1024  # ≤ 2GB
    
    @pytest.mark.slow
    def test_ai_exploration_time(self, monitor):
        """测试AI探索时间 - P0"""
        apk = "tests/fixtures/medium_app.apk"
        
        monitor.start()
        result = run_ai_exploration(apk)
        metrics = monitor.stop()
        
        # 验证探索时间（中等复杂度App ≤ 30分钟）
        exploration_time = (result.exploration_end - result.exploration_start).total_seconds()
        assert exploration_time <= 30 * 60
        
        # 验证资源消耗
        assert metrics.cpu_peak <= 80
        assert metrics.memory_peak <= 4 * 1024  # ≤ 4GB（探索更耗资源）
    
    def test_testcase_generation_time(self, monitor):
        """测试用例生成时间 - P0"""
        paths = load_json("tests/fixtures/exploration_paths.json")
        
        monitor.start()
        test_cases = generate_test_cases(paths)
        metrics = monitor.stop()
        
        # 验证生成时间
        assert metrics.duration <= 300  # ≤ 5分钟
        
        # 验证资源消耗
        assert metrics.cpu_peak <= 70
        assert metrics.memory_peak <= 2 * 1024
    
    @pytest.mark.parametrize("concurrency", [1, 3, 5])
    def test_concurrent_execution(self, concurrency):
        """测试并发执行性能 - P1/P2"""
        # 准备测试数据
        test_cases = load_json("tests/fixtures/test_cases.json")
        devices = connect_multiple_devices(concurrency)
        
        # 并发执行
        start_time = time.time()
        
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as executor:
            futures = [executor.submit(execute_tests, test_cases, device) 
                      for device in devices]
            reports = [f.result() for f in concurrent.futures.as_completed(futures)]
        
        total_time = time.time() - start_time
        
        # 验证并发性能
        if concurrency == 1:
            assert total_time <= 20 * len(test_cases) / 60  # ≤ 20秒/用例
        elif concurrency == 3:
            assert total_time <= (20 * len(test_cases) / 60) / 2.5  # 理想加速比2.5
        else:  # concurrency == 5
            assert total_time <= (20 * len(test_cases) / 60) / 4  # 理想加速比4
        
        # 验证所有执行都成功
        for report in reports:
            assert report.summary.total == len(test_cases)
```

#### 性能测试报告模板

```markdown
# VTest 性能测试报告

## 测试环境
- **硬件**: CPU Intel i7-11700K, 内存 32GB, 磁盘 NVMe SSD
- **软件**: Windows 11, Python 3.11, ADB 1.0.41
- **测试设备**: Pixel 6 (Android 12), 模拟器 (Android 10)

## 测试结果摘要

| 测试项 | 目标值 | 实测值 | 是否通过 |
|--------|--------|--------|----------|
| APK解析时间（中等App） | ≤ 60秒 | 45秒 | ✅ |
| AI探索时间（中等App） | ≤ 30分钟 | 25分钟 | ✅ |
| 用例生成时间 | ≤ 5分钟 | 3.5分钟 | ✅ |
| 单用例执行时间 | ≤ 20秒 | 15秒 | ✅ |
| 报告生成时间 | ≤ 30秒 | 22秒 | ✅ |
| CPU使用率（峰值） | ≤ 80% | 72% | ✅ |
| 内存使用量（峰值） | ≤ 2GB | 1.5GB | ✅ |

## 详细性能数据

### APK解析性能
- 小型APK（<10MB）: 平均 15秒
- 中型APK（10-50MB）: 平均 45秒
- 大型APK（>50MB）: 平均 120秒

### AI探索性能
- 探索速度: 平均 0.5 个Activity/分钟
- 路径生成速度: 平均 1.5 条路径/分钟

### 资源消耗趋势
[插入性能监控图表]

## 瓶颈分析
1. APK解析阶段：主要瓶颈在DEX文件解析
2. AI探索阶段：主要瓶颈在UI自动化执行
3. 建议优化点：...

## 结论
✅ 所有P0性能指标均通过
⚠️ P1指标"并发执行"需要进一步优化
```

---

### 2.3 接口测试（API Testing）

#### 接口列表与测试覆盖

VTest系统包含以下接口（包括内部进程间通信）：

| 接口类型 | 接口名称 |  endpoints  | 优先级 | 测试覆盖 |
|----------|----------|-------------|--------|----------|
| **REST API** | APK上传接口 | `POST /api/v1/apk/upload` | P0 | ✓ |
|  | APK解析状态查询 | `GET /api/v1/apk/{id}/status` | P0 | ✓ |
|  | 探索任务创建 | `POST /api/v1/exploration/start` | P0 | ✓ |
|  | 探索任务状态查询 | `GET /api/v1/exploration/{id}/status` | P0 | ✓ |
|  | 探索任务停止 | `POST /api/v1/exploration/{id}/stop` | P1 | ✓ |
|  | 测试用例生成 | `POST /api/v1/testcases/generate` | P0 | ✓ |
|  | 测试用例查询 | `GET /api/v1/testcases/{id}` | P0 | ✓ |
|  | 测试执行启动 | `POST /api/v1/execution/start` | P0 | ✓ |
|  | 测试执行状态查询 | `GET /api/v1/execution/{id}/status` | P0 | ✓ |
|  | 报告生成 | `POST /api/v1/report/generate` | P1 | ✓ |
|  | 报告下载 | `GET /api/v1/report/{id}/download` | P1 | ✓ |
| **内部IPC** | APK解析器 → 主进程 | gRPC: `APKParser.Parse()` | P0 | ✓ |
|  | AI探索引擎 → 主进程 | gRPC: `ExplorationEngine.Start()` | P0 | ✓ |
|  | 测试执行器 → 主进程 | gRPC: `TestExecutor.Execute()` | P0 | ✓ |
|  | ADB服务 → 测试执行器 | Socket: `ADBDevice.ExecuteCommand()` | P0 | ✓ |
| **Webhook** | 任务完成通知 | `POST /webhook/task-complete` | P2 | ✓ |
|  | 缺陷创建通知 | `POST /webhook/defect-created` | P2 | ✓ |

#### 接口测试示例

```python
# 示例：REST API接口测试
import pytest
import requests
from vtest.testing.api_client import VTestAPIClient

class TestRESTAPI:
    """REST API接口测试"""
    
    @pytest.fixture
    def client(self):
        return VTestAPIClient(base_url="http://localhost:8080")
    
    @pytest.fixture
    def auth_headers(self):
        # 获取认证token
        token = get_auth_token()
        return {"Authorization": f"Bearer {token}"}
    
    def test_apk_upload(self, client, auth_headers):
        """测试APK上传接口 - P0"""
        apk_path = "tests/fixtures/valid_app.apk"
        
        with open(apk_path, "rb") as f:
            files = {"file": f}
            response = requests.post(
                f"{client.base_url}/api/v1/apk/upload",
                files=files,
                headers=auth_headers
            )
        
        # 验证响应
        assert response.status_code == 200
        
        data = response.json()
        assert "task_id" in data
        assert data["status"] == "uploading"
        
        # 验证任务ID格式（UUID）
        import uuid
        assert uuid.UUID(data["task_id"])
    
    def test_apk_upload_invalid_file(self, client, auth_headers):
        """测试上传无效文件的接口 - P0"""
        invalid_file = "tests/fixtures/not_an_apk.txt"
        
        with open(invalid_file, "rb") as f:
            files = {"file": f}
            response = requests.post(
                f"{client.base_url}/api/v1/apk/upload",
                files=files,
                headers=auth_headers
            )
        
        # 验证错误响应
        assert response.status_code == 400
        
        data = response.json()
        assert "error" in data
        assert "Not a valid APK file" in data["error"]
    
    def test_exploration_start(self, client, auth_headers):
        """测试启动AI探索接口 - P0"""
        # 先上传并解析APK
        apk_task_id = self._upload_and_wait(client, auth_headers)
        
        # 启动探索
        payload = {
            "apk_task_id": apk_task_id,
            "device_id": "emulator-5554",
            "timeout": 1800  # 30分钟
        }
        
        response = requests.post(
            f"{client.base_url}/api/v1/exploration/start",
            json=payload,
            headers=auth_headers
        )
        
        # 验证响应
        assert response.status_code == 200
        
        data = response.json()
        assert "exploration_id" in data
        assert data["status"] == "running"
    
    def test_exploration_status(self, client, auth_headers):
        """测试查询探索状态接口 - P0"""
        # 启动探索
        exploration_id = self._start_exploration(client, auth_headers)
        
        # 查询状态
        response = requests.get(
            f"{client.base_url}/api/v1/exploration/{exploration_id}/status",
            headers=auth_headers
        )
        
        # 验证响应
        assert response.status_code == 200
        
        data = response.json()
        assert "status" in data
        assert data["status"] in ["running", "completed", "failed"]
        
        if data["status"] == "running":
            assert "progress" in data
            assert 0 <= data["progress"] <= 100
    
    def _upload_and_wait(self, client, auth_headers):
        """辅助方法：上传APK并等待解析完成"""
        # ... 实现细节
        pass
    
    def _start_exploration(self, client, auth_headers):
        """辅助方法：启动探索并返回exploration_id"""
        # ... 实现细节
        pass
```

```python
# 示例：内部IPC接口测试（使用gRPC）
import pytest
import grpc
from vtest.protobuf import apk_parser_pb2, apk_parser_pb2_grpc

class TestInternalIPC:
    """内部进程间通信接口测试"""
    
    @pytest.fixture
    def grpc_channel(self):
        channel = grpc.insecure_channel("localhost:50051")
        yield channel
        channel.close()
    
    @pytest.fixture
    def stub(self, grpc_channel):
        return apk_parser_pb2_grpc.APKParserStub(grpc_channel)
    
    def test_apk_parse_grpc(self, stub):
        """测试APK解析gRPC接口 - P0"""
        # 准备请求
        request = apk_parser_pb2.ParseRequest(
            apk_path="tests/fixtures/valid_app.apk",
            options=apk_parser_pb2.ParseOptions(
                extract_activities=True,
                extract_permissions=True
            )
        )
        
        # 调用gRPC接口
        response = stub.Parse(request, timeout=60)
        
        # 验证响应
        assert response.status == apk_parser_pb2.ParseStatus.SUCCESS
        assert response.app_info.package_name != ""
        assert len(response.activities) > 0
        assert response.parse_time <= 60
    
    def test_apk_parse_grpc_invalid_file(self, stub):
        """测试gRPC接口处理无效文件 - P0"""
        request = apk_parser_pb2.ParseRequest(
            apk_path="tests/fixtures/not_an_apk.txt"
        )
        
        # 验证返回错误状态（而不是抛出异常）
        response = stub.Parse(request, timeout=60)
        
        assert response.status == apk_parser_pb2.ParseStatus.FAILURE
        assert response.error_message != ""
    
    def test_apk_parse_grpc_timeout(self, stub):
        """测试gRPC接口超时处理 - P1"""
        request = apk_parser_pb2.ParseRequest(
            apk_path="tests/fixtures/large_app.apk"
        )
        
        # 设置非常短的超时时间
        with pytest.raises(grpc.RpcError) as exc_info:
            stub.Parse(request, timeout=0.001)
        
        assert exc_info.value.code() == grpc.StatusCode.DEADLINE_EXCEEDED
```

---

### 2.4 兼容性测试（Compatibility Testing）

#### Android版本兼容性矩阵

| Android版本 | API Level | 设备类型 | 优先级 | 测试覆盖 |
|-------------|-----------|----------|--------|----------|
| 8.0 (Oreo) | 26 | 真机+模拟器 | P0 | ✓ |
| 8.1 (Oreo) | 27 | 模拟器 | P1 | ✓ |
| 9.0 (Pie) | 28 | 真机+模拟器 | P0 | ✓ |
| 10.0 (Q) | 29 | 真机+模拟器 | P0 | ✓ |
| 11 (R) | 30 | 真机+模拟器 | P0 | ✓ |
| 12 (S) | 31 | 真机+模拟器 | P0 | ✓ |
| 12L (Sv2) | 32 | 模拟器 | P1 | ✓ |
| 13 (Tiramisu) | 33 | 真机+模拟器 | P1 | ✓ |
| 14 (Upside Down Cake) | 34 | 真机+模拟器 | P0 | ✓ |
| 15 (Vanilla Ice Cream) | 35 | 模拟器 | P2 | ✗ |

#### 设备兼容性测试

| 设备类型 | 分辨率 | CPU架构 | 优先级 | 测试覆盖 |
|----------|--------|---------|--------|----------|
| **手机** |  |  |  |  |
| Pixel 6 | 1080x2400 | arm64-v8a | P0 | ✓ |
| Samsung Galaxy S21 | 1080x2400 | arm64-v8a | P1 | ✓ |
| 小米 Redmi Note 10 | 1080x2400 | arm64-v8a | P1 | ✓ |
| 低分辨率手机 | 720x1280 | armeabi-v7a | P1 | ✓ |
| **平板** |  |  |  |  |
| Pixel Tablet | 2560x1600 | arm64-v8a | P1 | ✓ |
| **模拟器** |  |  |  |  |
| x86_64模拟器 | 1080x1920 | x86_64 | P0 | ✓ |
| arm64模拟器 | 1080x1920 | arm64-v8a | P1 | ✓ |

#### 兼容性测试示例

```python
# 示例：兼容性测试
import pytest
from vtest.testing.device_manager import DeviceManager

class TestCompatibility:
    """兼容性测试"""
    
    @pytest.fixture
    def device_manager(self):
        return DeviceManager()
    
    @pytest.mark.parametrize("android_version,api_level", [
        ("8.0", 26),
        ("9.0", 28),
        ("10.0", 29),
        ("11", 30),
        ("12", 31),
        ("14", 34),
    ])
    def test_apk_exploration_compatibility(self, android_version, api_level, device_manager):
        """测试AI探索在不同Android版本的兼容性 - P0"""
        # 连接对应版本的设备
        device = device_manager.connect_device(android_version)
        
        assert device is not None
        assert device.android_version == android_version
        assert device.api_level == api_level
        
        # 执行AI探索
        apk = "tests/fixtures/compatible_app.apk"
        result = run_ai_exploration(apk, device)
        
        # 验证探索成功
        assert result.status == "completed"
        assert result.coverage_summary.explored_activities > 0
        
        # 验证探索结果在不同Android版本的一致性（允许±10%误差）
        if android_version == "10.0":  # 以Android 10为基准
            baseline_coverage = result.coverage_summary.coverage_rate
        
        if android_version != "10.0":
            assert abs(result.coverage_summary.coverage_rate - baseline_coverage) <= 0.1
    
    @pytest.mark.parametrize("device_type,resolution", [
        ("phone", (1080, 2400)),
        ("tablet", (2560, 1600)),
        ("low_res_phone", (720, 1280)),
    ])
    def test_ui_interaction_compatibility(self, device_type, resolution, device_manager):
        """测试UI交互在不同分辨率的兼容性"""
        # 连接对应分辨率的设备
        device = device_manager.connect_device(resolution=resolution)
        
        assert device.resolution == resolution
        
        # 执行UI交互测试
        test_case = load_json("tests/fixtures/ui_test_case.json")
        result = execute_test(test_case, device)
        
        # 验证UI交互成功
        assert result.status == "passed"
        
        # 验证截图清晰度
        for step in result.steps:
            screenshot = Image.open(step.screenshot)
            assert screenshot.size == resolution  # 截图分辨率与设备一致
    
    @pytest.mark.parametrize("cpu_arch", [
        "arm64-v8a",
        "armeabi-v7a",
        "x86_64",
    ])
    def test_native_library_compatibility(self, cpu_arch, device_manager):
        """测试原生库在不同CPU架构的兼容性"""
        # 连接对应CPU架构的设备/模拟器
        device = device_manager.connect_device(cpu_arch=cpu_arch)
        
        assert device.cpu_arch == cpu_arch
        
        # 使用包含原生库的APK
        apk = "tests/fixtures/app_with_native_libs.apk"
        result = install_and_run(apk, device)
        
        # 验证原生库加载成功
        assert result.native_libs_loaded == True
        assert result.crash_count == 0
```

#### 兼容性测试报告模板

```markdown
# VTest 兼容性测试报告

## 测试环境
- **测试时间**: 2026-06-07
- **测试人员**: 自动化测试 + 人工验证
- **测试设备**: 见下方矩阵

## Android版本兼容性矩阵

| Android版本 | API Level | 测试设备 | 探索成功率 | 覆盖率 | 状态 |
|-------------|-----------|----------|------------|--------|------|
| 8.0 | 26 | Pixel (模拟器) | 95% | 82% | ✅ |
| 9.0 | 28 | Pixel 3a (真机) | 98% | 87% | ✅ |
| 10.0 | 29 | Pixel 4 (真机) | 100% | 91% | ✅ |
| 11 | 30 | Pixel 5 (真机) | 100% | 90% | ✅ |
| 12 | 31 | Pixel 6 (真机) | 98% | 88% | ✅ |
| 14 | 34 | Pixel 8 (真机) | 95% | 85% | ⚠️ |

**说明**:
- ✅ 完全兼容
- ⚠️ 部分功能受限（Android 14的隐私限制导致部分UI元素无法获取）
- ❌ 不兼容

## 设备兼容性矩阵

| 设备 | 分辨率 | CPU架构 | 安装成功 | 探索成功 | 执行成功 | 状态 |
|------|--------|---------|----------|----------|----------|------|
| Pixel 6 | 1080x2400 | arm64-v8a | ✅ | ✅ | ✅ | ✅ |
| 小米Red米Note 10 | 1080x2400 | arm64-v8a | ✅ | ✅ | ✅ | ✅ |
| 低分辨率手机 | 720x1280 | armeabi-v7a | ✅ | ⚠️ | ✅ | ⚠️ |
| Pixel Tablet | 2560x1600 | arm64-v8a | ✅ | ✅ | ✅ | ✅ |
| x86_64模拟器 | 1080x1920 | x86_64 | ✅ | ✅ | ✅ | ✅ |

**已知问题**:
1. Android 14的隐私限制：无法获取某些系统应用的UI层级
2. 低分辨率设备（720p）的UI元素定位准确率下降（85% → 75%）

## 建议
1. 针对Android 14的隐私限制，需要适配新的UI自动化API
2. 针对低分辨率设备，优化UI元素定位算法
```

---

### 2.5 集成测试（Integration Testing）

#### 模块间集成验证点

VTest系统的模块依赖关系：

```
┌─────────────────┐
│   前端UI层      │
│  (React/Vue)    │
└────────┬────────┘
         │ HTTP/WebSocket
┌────────▼────────┐
│   API网关层     │
│  (Flask/FastAPI)│
└────────┬────────┘
         │ gRPC
┌────────▼────────┐
│   核心业务逻辑层 │
├─────────────────┤
│ - APK解析器     │
│ - AI探索引擎    │
│ - 测试用例生成器 │
│ - 测试执行器     │
│ - 报告生成器     │
└────────┬────────┘
         │ gRPC/Socket
┌────────▼────────┐
│   底层服务层    │
├─────────────────┤
│ - ADB服务       │
│ - Android模拟器  │
│ - 设备管理服务   │
└─────────────────┘
```

#### 集成测试验证点

| 集成点 | 上游模块 | 下游模块 | 验证点 | 优先级 | 测试覆盖 |
|--------|----------|----------|--------|--------|----------|
| IP-01 | 前端UI | API网关 | 1. 上传APK的HTTP请求格式<br>2. 探索进度WebSocket推送<br>3. 错误响应的前端展示 | P0 | ✓ |
| IP-02 | API网关 | APK解析器 | 1. gRPC请求格式<br>2. 解析进度回调<br>3. 解析结果返回 | P0 | ✓ |
| IP-03 | APK解析器 | AI探索引擎 | 1. 解析结果传递给探索引擎<br>2. Activity列表完整性<br>3. 权限信息传递给探索引擎 | P0 | ✓ |
| IP-04 | AI探索引擎 | 测试执行器 | 1. 探索路径传递给执行器<br>2. 设备连接信息同步<br>3. 探索结果持久化 | P0 | ✓ |
| IP-05 | 测试执行器 | ADB服务 | 1. ADB命令格式正确性<br>2. 设备断开重连机制<br>3. 并发执行时的设备争用 | P0 | ✓ |
| IP-06 | 测试执行器 | 报告生成器 | 1. 执行结果传递给报告生成器<br>2. 截图和日志文件传递<br>3. 报告生成进度 | P0 | ✓ |
| IP-07 | 报告生成器 | 缺陷追踪系统 | 1. 失败用例信息传递给Jira/GitHub<br>2. 附件上传<br>3. 缺陷ID回写 | P1 | ✓ |
| IP-08 | 所有模块 | 数据库 | 1. 数据持久化正确性<br>2. 并发读写一致性<br>3. 数据恢复机制 | P0 | ✓ |

#### 集成测试示例

```python
# 示例：集成测试
import pytest
from vtest.integration.test_helpers import (
    start_mock_apk_parser,
    start_mock_ai_exploration_engine,
    start_mock_test_executor,
    start_mock_adb_service
)

class TestIntegration:
    """集成测试"""
    
    @pytest.fixture(scope="class")
    def mock_services(self):
        """启动所有Mock服务"""
        services = [
            start_mock_apk_parser(),
            start_mock_ai_exploration_engine(),
            start_mock_test_executor(),
            start_mock_adb_service()
        ]
        
        yield services
        
        # 清理：停止所有服务
        for service in services:
            service.stop()
    
    def test_ip01_frontend_to_api_gateway(self, mock_services):
        """测试集成点IP-01：前端UI → API网关 - P0"""
        # 模拟前端上传APK
        from vtest.frontend.api_client import FrontendAPIClient
        
        client = FrontendAPIClient()
        
        # 上传APK
        with open("tests/fixtures/valid_app.apk", "rb") as f:
            response = client.upload_apk(f)
        
        assert response.status_code == 200
        assert "task_id" in response.json()
        
        task_id = response.json()["task_id"]
        
        # 验证WebSocket进度推送
        import websocket
        ws = websocket.create_connection(f"ws://localhost:8080/ws/task/{task_id}")
        
        # 接收进度更新
        messages = []
        while True:
            msg = ws.recv()
            messages.append(msg)
            
            if '"status": "completed"' in msg:
                break
        
        ws.close()
        
        # 验证收到了进度更新
        assert len(messages) > 0
        
        # 验证最终的完成消息
        final_msg = json.loads(messages[-1])
        assert final_msg["status"] == "completed"
    
    def test_ip02_api_gateway_to_apk_parser(self, mock_services):
        """测试集成点IP-02：API网关 → APK解析器 - P0"""
        # 模拟API网关调用APK解析器的gRPC接口
        import grpc
        from vtest.protobuf import apk_parser_pb2, apk_parser_pb2_grpc
        
        channel = grpc.insecure_channel("localhost:50051")
        stub = apk_parser_pb2_grpc.APKParserStub(channel)
        
        # 准备请求
        request = apk_parser_pb2.ParseRequest(
            apk_path="tests/fixtures/valid_app.apk"
        )
        
        # 调用gRPC接口
        response = stub.Parse(request, timeout=60)
        
        # 验证响应格式
        assert response.status == apk_parser_pb2.ParseStatus.SUCCESS
        assert response.app_info.package_name == "com.example.vtestdemo"
        assert len(response.activities) == 12
        
        # 验证解析进度回调（如果支持）
        # ...
        
        channel.close()
    
    def test_ip03_apk_parser_to_ai_exploration_engine(self, mock_services):
        """测试集成点IP-03：APK解析器 → AI探索引擎 - P0"""
        # 先解析APK
        parse_result = self._parse_apk()
        
        # 验证解析结果能正确传递给探索引擎
        from vtest.core.exploration_engine import ExplorationEngine
        
        engine = ExplorationEngine()
        exploration_result = engine.start(
            apk_info=parse_result.app_info,
            activities=parse_result.activities,
            permissions=parse_result.permissions
        )
        
        # 验证探索引擎收到了完整的Activity列表
        assert len(exploration_result.activities) == len(parse_result.activities)
        assert set(exploration_result.activities) == set(parse_result.activities)
        
        # 验证权限信息也传递了
        assert exploration_result.permissions == parse_result.permissions
    
    def test_ip05_test_executor_to_adb_service(self, mock_services):
        """测试集成点IP-05：测试执行器 → ADB服务 - P0"""
        # 准备测试设备和测试用例
        device = connect_device("emulator-5554")
        test_case = load_json("tests/fixtures/test_case.json")
        
        # 执行测试
        from vtest.core.test_executor import TestExecutor
        
        executor = TestExecutor()
        
        # 模拟设备断开
        def disconnect_device_after_5_seconds():
            time.sleep(5)
            device.disconnect()
        
        import threading
        threading.Thread(target=disconnect_device_after_5_seconds).start()
        
        # 执行测试（应该能自动重连）
        result = executor.execute(test_case, device)
        
        # 验证设备断开重连机制
        assert result.device_disconnected_count == 1
        assert result.device_reconnected == True
        assert result.status == "passed"  # 重连后继续执行
        
        # 验证并发执行时的设备争用处理
        # ...（略）
    
    def _parse_apk(self):
        """辅助方法：解析APK"""
        # ... 实现细节
        pass
```

---

## 3. 5S评审检查清单

### 3.1 Standard（标准）：功能完整性检查清单（20项）

**目标**: 确保系统功能完整、符合需求和行业标准。

| # | 检查项 | 检查标准 | 检查方法 | 必须通过 |
|---|--------|----------|----------|----------|
| S01 | APK上传功能完整 | 支持拖拽上传、点击上传、批量上传 | 手动测试+自动化测试 | ✅ |
| S02 | APK解析结果完整 | 包含app_name, package_name, version, activities, permissions等 | 验证输出JSON Schema | ✅ |
| S03 | AI探索路径生成完整 | 生成exploration_paths.json，包含每条路径的步骤序列 | 验证输出JSON Schema | ✅ |
| S04 | 测试用例生成完整 | 生成test_cases.json，包含preconditions, steps, expected_result | 验证输出JSON Schema | ✅ |
| S05 | 测试执行结果完整 | 生成execution_report.json，包含每个用例的执行结果 | 验证输出JSON Schema | ✅ |
| S06 | 报告生成格式完整 | 支持HTML、PDF、JUnit XML三种格式 | 验证导出功能 | ✅ |
| S07 | 缺陷追踪集成完整 | 支持Jira、GitHub Issues | 验证集成功能 | ⚠️ |
| S08 | 用户文档完整 | 包含安装指南、用户手册、API文档 | 文档审查 | ✅ |
| S09 | 错误处理完整 | 所有API都有错误处理和错误提示 | 单元测试（异常场景） | ✅ |
| S10 | 日志记录完整 | 所有关键操作都有日志记录 | 代码审查+日志检查 | ✅ |
| S11 | 配置管理完整 | 支持配置文件、环境变量、命令行参数 | 配置测试 | ✅ |
| S12 | 数据库操作完整 | 所有数据都能正确持久化 | 集成测试 | ✅ |
| S13 | API接口完整 | 所有功能都有对应的API接口 | API文档审查 | ✅ |
| S14 | 前端UI完整 | 所有功能都有对应的UI界面 | UI测试 | ✅ |
| S15 | 输入验证完整 | 所有用户输入都有验证 | 安全测试 | ✅ |
| S16 | 输出格式标准化 | 所有输出都符合JSON Schema | Schema验证 | ✅ |
| S17 | 状态码标准化 | 所有API都使用标准的HTTP状态码 | API测试 | ✅ |
| S18 | 错误消息标准化 | 所有错误消息都有统一的格式 | 错误测试 | ✅ |
| S19 | 符合行业术语 | 使用标准的测试行业术语 | 文档审查 | ⚠️ |
| S20 | 符合Android开发规范 | APK解析、UI自动化符合Android规范 | 代码审查 | ✅ |

**检查方法示例（S01）**:
```python
def check_s01_apk_upload_completeness():
    """检查APK上传功能完整性"""
    checks = []
    
    # 1. 检查拖拽上传
    drag_drop_supported = check_drag_drop_upload()
    checks.append(("拖拽上传", drag_drop_supported))
    
    # 2. 检查点击上传
    click_upload_supported = check_click_upload()
    checks.append(("点击上传", click_upload_supported))
    
    # 3. 检查批量上传
    batch_upload_supported = check_batch_upload()
    checks.append(("批量上传", batch_upload_supported))
    
    # 4. 检查上传进度显示
    progress_display_supported = check_upload_progress()
    checks.append(("进度显示", progress_display_supported))
    
    # 5. 检查上传取消
    cancel_supported = check_upload_cancel()
    checks.append(("取消上传", cancel_supported))
    
    # 输出检查结果
    all_passed = all(c[1] for c in checks)
    
    print("S01 APK上传功能完整性检查:")
    for name, passed in checks:
        status = "✅" if passed else "❌"
        print(f"  {status} {name}")
    
    return all_passed
```

---

### 3.2 Secure（安全）：安全合规检查清单（15项）

**目标**: 确保系统安全、符合数据保护和隐私法规。

| # | 检查项 | 检查标准 | 检查方法 | 必须通过 |
|---|--------|----------|----------|----------|
| SE01 | APK文件安全扫描 | 上传的APK不包含恶意代码 | 使用VirusTotal API扫描 | ✅ |
| SE02 | 用户认证安全 | 所有API都需要认证（除了健康检查和文档） | 安全测试 | ✅ |
| SE03 | 权限控制安全 | 不同用户角色有不同的权限 | 权限测试 | ✅ |
| SE04 | 输入验证安全 | 防止SQL注入、XSS、路径遍历等 | 安全扫描工具（OWASP ZAP） | ✅ |
| SE05 | 敏感数据加密 | 密码、API密钥等敏感数据加密存储 | 代码审查+配置检查 | ✅ |
| SE06 | 通信加密 | 所有API通信使用HTTPS | 网络抓包检查 | ✅ |
| SE07 | 日志安全 | 日志中不包含敏感信息（密码、token等） | 日志审查 | ✅ |
| SE08 | 错误处理安全 | 错误信息不包含敏感信息（路径、堆栈等） | 错误测试 | ✅ |
| SE09 | 文件上传安全 | 限制上传文件类型、大小，防止恶意文件上传 | 安全测试 | ✅ |
| SE10 | 会话管理安全 | 会话超时、会话固定攻击防护 | 安全测试 | ✅ |
| SE11 | CSRF防护 | 所有状态修改操作都有CSRF token | 安全测试 | ✅ |
| SE12 | XSS防护 | 所有用户输入都进行转义 | 安全测试 | ✅ |
| SE13 | 依赖库安全 | 所有依赖库没有已知漏洞 | 依赖扫描（pip-audit, npm audit） | ✅ |
| SE14 | 隐私合规 | 符合GDPR、个人信息保护法等 | 隐私影响评估 | ✅ |
| SE15 | 安全配置 | 生产环境不使用默认密码、调试模式关闭 | 配置审查 | ✅ |

**检查方法示例（SE01）**:
```python
def check_se01_apk_security_scan():
    """检查APK文件安全扫描"""
    import requests
    
    # 准备测试APK
    test_apk = "tests/fixtures/valid_app.apk"
    
    # 上传APK
    with open(test_apk, "rb") as f:
        response = requests.post(
            "http://localhost:8080/api/v1/apk/upload",
            files={"file": f}
        )
    
    task_id = response.json()["task_id"]
    
    # 等待安全扫描完成
    import time
    while True:
        status_response = requests.get(
            f"http://localhost:8080/api/v1/apk/{task_id}/status"
        )
        status = status_response.json()["status"]
        
        if status == "completed":
            break
        elif status == "failed":
            raise Exception("APK processing failed")
        
        time.sleep(5)
    
    # 获取安全扫描结果
    result_response = requests.get(
        f"http://localhost:8080/api/v1/apk/{task_id}/security-report"
    )
    
    security_report = result_response.json()
    
    # 验证安全扫描结果
    assert "virus_total_scan" in security_report
    assert security_report["virus_total_scan"]["positives"] == 0  # 没有检测到恶意代码
    
    print("SE01 APK文件安全扫描: ✅")
    return True
```

**检查方法示例（SE04）**:
```python
def check_se04_input_validation_security():
    """检查输入验证安全"""
    import requests
    
    # 测试SQL注入
    sql_injection_payloads = [
        "' OR '1'='1",
        "'; DROP TABLE users; --",
        "' UNION SELECT * FROM users; --"
    ]
    
    for payload in sql_injection_payloads:
        response = requests.post(
            "http://localhost:8080/api/v1/search",
            json={"query": payload}
        )
        
        # 验证没有SQL错误泄露
        assert "SQL syntax" not in response.text
        assert "mysql_error" not in response.text.lower()
    
    # 测试XSS
    xss_payloads = [
        "<script>alert('XSS')</script>",
        "<img src=x onerror=alert('XSS')>",
        "javascript:alert('XSS')"
    ]
    
    for payload in xss_payloads:
        response = requests.post(
            "http://localhost:8080/api/v1/feedback",
            json={"message": payload}
        )
        
        # 验证输入被转义
        assert "<script>" not in response.text
        assert "alert(" not in response.text
    
    # 测试路径遍历
    path_traversal_payloads = [
        "../../../etc/passwd",
        "..\\..\\..\\windows\\system32\\config\\SAM"
    ]
    
    for payload in path_traversal_payloads:
        response = requests.get(
            f"http://localhost:8080/api/v1/files/{payload}"
        )
        
        # 验证路径遍历被阻止
        assert response.status_code == 400
        assert "Invalid file path" in response.json()["error"]
    
    print("SE04 输入验证安全: ✅")
    return True
```

---

### 3.3 Scalable（可扩展）：扩展性检查清单（10项）

**目标**: 确保系统能够应对业务增长和技术演进。

| # | 检查项 | 检查标准 | 检查方法 | 必须通过 |
|---|--------|----------|----------|----------|
| SC01 | 水平扩展能力 | 支持增加服务器实例来处理更多请求 | 负载测试 | ⚠️ |
| SC02 | 垂直扩展能力 | 支持增加服务器资源（CPU、内存）来提升性能 | 性能测试 | ✅ |
| SC03 | 数据库扩展能力 | 支持数据库读写分离、分库分表 | 架构审查 | ⚠️ |
| SC04 | 缓存机制 | 支持Redis等缓存来提升性能 | 代码审查 | ⚠️ |
| SC05 | 异步处理能力 | 长时间任务（如AI探索）支持异步执行 | 代码审查+测试 | ✅ |
| SC06 | 消息队列 | 支持使用消息队列来解耦模块 | 架构审查 | ⚠️ |
| SC07 | 插件机制 | 支持通过插件来扩展功能 | 代码审查+插件开发测试 | ⚠️ |
| SC08 | API版本控制 | 支持API版本控制，保证向后兼容 | API测试 | ✅ |
| SC09 | 配置外部化 | 支持通过配置文件、环境变量来配置系统 | 配置测试 | ✅ |
| SC10 | 模块化设计 | 代码结构清晰，模块之间低耦合 | 代码审查（依赖分析） | ✅ |

**检查方法示例（SC01）**:
```python
def check_sc01_horizontal_scalability():
    """检查水平扩展能力"""
    # 启动多个VTest实例
    instances = []
    for i in range(3):
        instance = start_vtest_instance(port=8080+i)
        instances.append(instance)
    
    # 配置负载均衡（使用NGINX或HAProxy）
    configure_load_balancer(instances)
    
    # 执行负载测试
    import threading
    import time
    
    def send_requests(instance):
        """向指定实例发送请求"""
        results = []
        for _ in range(100):
            response = requests.get(f"http://localhost:8080/health")
            results.append(response.status_code)
        return results
    
    # 并发发送请求到负载均衡器
    threads = []
    results = []
    
    for _ in range(10):  # 10个并发线程
        thread = threading.Thread(target=lambda: results.extend(send_requests(None)))
        threads.append(thread)
        thread.start()
    
    for thread in threads:
        thread.join()
    
    # 验证所有请求都成功
    success_rate = sum(1 for r in results if r == 200) / len(results)
    assert success_rate >= 0.95
    
    # 验证请求被均匀分配到各个实例
    for instance in instances:
        assert instance.request_count > 0
        assert abs(instance.request_count - len(results) / len(instances)) < len(results) * 0.1
    
    print("SC01 水平扩展能力: ✅")
    
    # 清理
    for instance in instances:
        instance.stop()
    
    return True
```

**检查方法示例（SC05）**:
```python
def check_sc05_async_processing():
    """检查异步处理能力"""
    import time
    
    # 启动一个长时间的AI探索任务
    response = requests.post(
        "http://localhost:8080/api/v1/exploration/start",
        json={
            "apk_task_id": "test_apk_001",
            "device_id": "emulator-5554"
        }
    )
    
    assert response.status_code == 200
    exploration_id = response.json()["exploration_id"]
    
    # 验证立即返回，不阻塞
    assert response.elapsed.total_seconds() < 5  # 5秒内返回
    
    # 验证可以通过API查询任务状态
    status_response = requests.get(
        f"http://localhost:8080/api/v1/exploration/{exploration_id}/status"
    )
    
    assert status_response.status_code == 200
    assert status_response.json()["status"] in ["running", "pending"]
    
    # 验证任务在后台继续执行
    import time
    while True:
        status_response = requests.get(
            f"http://localhost:8080/api/v1/exploration/{exploration_id}/status"
        )
        status = status_response.json()["status"]
        
        if status == "completed":
            break
        elif status == "failed":
            raise Exception("Exploration failed")
        
        time.sleep(10)
    
    print("SC05 异步处理能力: ✅")
    return True
```

---

### 3.4 Stable（稳定）：稳定性检查清单（12项）

**目标**: 确保系统稳定、可靠、健壮。

| # | 检查项 | 检查标准 | 检查方法 | 必须通过 |
|---|--------|----------|----------|----------|
| ST01 | 长时间运行稳定性 | 系统能连续运行7天不掉线 | 稳定性测试 | ✅ |
| ST02 | 内存泄漏检测 | 长时间运行后内存使用量不持续增长 | 性能监控 | ✅ |
| ST03 | CPU使用率稳定 | 空闲时CPU使用率 ≤ 5% | 性能监控 | ✅ |
| ST04 | 异常处理完整性 | 所有异常都有捕获和处理 | 代码审查+异常测试 | ✅ |
| ST05 | 错误恢复能力 | 模块崩溃后能自动恢复 | 故障注入测试 | ✅ |
| ST06 | 数据一致性 | 崩溃恢复后数据不丢失、不损坏 | 故障注入测试 | ✅ |
| ST07 | 并发安全性 | 多线程/多进程并发操作数据一致 | 并发测试 | ✅ |
| ST08 | 资源释放 | 文件、数据库连接等资源正确释放 | 资源监控 | ✅ |
| ST09 | 超时处理 | 所有外部调用都有超时机制 | 代码审查+超时测试 | ✅ |
| ST10 | 重试机制 | 临时性失败有重试机制 | 故障注入测试 | ✅ |
| ST11 | 降级机制 | 依赖服务故障时能降级运行 | 故障注入测试 | ⚠️ |
| ST12 | 监控和告警 | 关键指标有监控，异常有告警 | 监控检查 | ✅ |

**检查方法示例（ST01）**:
```python
def check_st01_long_running_stability():
    """检查长时间运行稳定性"""
    import time
    import psutil
    
    # 启动VTest系统
    start_vtest_system()
    
    # 运行7天（为了测试效率，可以改为7小时）
    test_duration = 7 * 24 * 60 * 60  # 7天（秒）
    # test_duration = 7 * 60 * 60  # 7小时（用于测试）
    
    start_time = time.time()
    crash_count = 0
    
    while time.time() - start_time < test_duration:
        # 检查系统是否还在运行
        try:
            response = requests.get("http://localhost:8080/health", timeout=5)
            assert response.status_code == 200
        except:
            # 系统崩溃，记录并重启
            crash_count += 1
            print(f"系统崩溃，已重启 ({crash_count}次)")
            restart_vtest_system()
        
        # 每隔1小时执行一次完整的工作流
        if int(time.time() - start_time) % 3600 == 0:
            run_full_workflow()
        
        time.sleep(60)  # 每分钟检查一次
    
    # 验证稳定性
    assert crash_count == 0, f"系统崩溃了{crash_count}次"
    
    print("ST01 长时间运行稳定性: ✅")
    return True
```

**检查方法示例（ST05）**:
```python
def check_st05_error_recovery():
    """检查错误恢复能力"""
    # 测试AI探索引擎崩溃恢复
    
    # 1. 启动AI探索任务
    exploration_id = start_exploration("tests/fixtures/valid_app.apk")
    
    # 2. 等待探索开始
    time.sleep(10)
    
    # 3. 模拟AI探索引擎崩溃
    kill_process("ai_exploration_engine")
    
    # 4. 验证系统检测到崩溃并尝试恢复
    time.sleep(5)
    
    status_response = requests.get(
        f"http://localhost:8080/api/v1/exploration/{exploration_id}/status"
    )
    
    status = status_response.json()["status"]
    assert status in ["recovering", "running"]  # 系统正在恢复或已恢复
    
    # 5. 等待恢复完成
    while True:
        status_response = requests.get(
            f"http://localhost:8080/api/v1/exploration/{exploration_id}/status"
        )
        status = status_response.json()["status"]
        
        if status == "completed":
            break
        elif status == "failed":
            raise Exception("Exploration failed after recovery")
        
        time.sleep(10)
    
    # 验证探索结果完整
    result_response = requests.get(
        f"http://localhost:8080/api/v1/exploration/{exploration_id}/result"
    )
    
    result = result_response.json()
    assert len(result["paths"]) > 0  # 探索路径不为空
    
    print("ST05 错误恢复能力: ✅")
    return True
```

---

### 3.5 Sustainable（可持续）：可维护性检查清单（8项）

**目标**: 确保系统易于维护、升级和演进。

| # | 检查项 | 检查标准 | 检查方法 | 必须通过 |
|---|--------|----------|----------|----------|
| SU01 | 代码可读性 | 代码符合PEP 8（Python）或相应语言的编码规范 | 静态代码分析（flake8, pylint） | ✅ |
| SU02 | 代码注释完整性 | 所有公共API、复杂逻辑都有注释 | 代码审查 | ✅ |
| SU03 | 单元测试覆盖率 | 核心模块单元测试覆盖率 ≥ 80% | 覆盖率工具（pytest-cov） | ✅ |
| SU04 | 集成测试覆盖率 | 所有集成点都有集成测试 | 测试审查 | ✅ |
| SU05 | 文档完整性 | 架构文档、API文档、部署文档完整 | 文档审查 | ✅ |
| SU06 | 代码复杂度 | 圈复杂度 ≤ 10，方法长度 ≤ 50行 | 静态代码分析（radon, lizard） | ⚠️ |
| SU07 | 依赖管理 | 依赖库版本固定，有依赖漏洞扫描 | 配置检查+依赖扫描 | ✅ |
| SU08 | CI/CD流水线 | 有完整的CI/CD流水线，自动构建、测试、部署 | CI/CD配置审查 | ✅ |

**检查方法示例（SU01）**:
```python
def check_su01_code_readability():
    """检查代码可读性"""
    import subprocess
    
    # 使用flake8检查Python代码规范性
    result = subprocess.run(
        ["flake8", "vtest/", "--max-line-length=120", "--exclude=venv/,node_modules/"],
        capture_output=True,
        text=True
    )
    
    # 统计错误数
    error_count = len(result.stdout.strip().split("\n")) if result.stdout.strip() else 0
    
    # 允许的错误数：每1000行代码不超过10个错误
    total_lines = count_total_lines("vtest/")
    max_errors = int(total_lines / 1000) * 10
    
    assert error_count <= max_errors, f"Flake8错误数{error_count}超过阈值{max_errors}"
    
    print(f"SU01 代码可读性: ✅ (Flake8错误数: {error_count})")
    return True
```

**检查方法示例（SU03）**:
```python
def check_su03_unit_test_coverage():
    """检查单元测试覆盖率"""
    import subprocess
    import json
    
    # 运行单元测试并生成覆盖率报告
    result = subprocess.run(
        ["pytest", "--cov=vtest/", "--cov-report=json:coverage.json"],
        capture_output=True,
        text=True
    )
    
    # 读取覆盖率报告
    with open("coverage.json", "r") as f:
        coverage_data = json.load(f)
    
    # 计算总体覆盖率
    total_lines = coverage_data["totals"]["num_statements"]
    covered_lines = coverage_data["totals"]["covered_lines"]
    coverage_rate = covered_lines / total_lines
    
    # 验证覆盖率 ≥ 80%
    assert coverage_rate >= 0.80, f"单元测试覆盖率{coverage_rate:.2%}低于80%"
    
    # 验证核心模块覆盖率 ≥ 90%
    core_modules = ["apk_parser", "exploration_engine", "test_executor"]
    for module in core_modules:
        module_coverage = get_module_coverage(coverage_data, module)
        assert module_coverage >= 0.90, f"核心模块{module}覆盖率{module_coverage:.2%}低于90%"
    
    print(f"SU03 单元测试覆盖率: ✅ ({coverage_rate:.2%})")
    return True

def get_module_coverage(coverage_data, module_name):
    """获取指定模块的覆盖率"""
    # ... 实现细节
    pass
```

---

### 5S评审汇总

**评审执行方法**:
1. 为每个S创建独立的检查脚本（如 `check_standard.py`, `check_secure.py`等）
2. 在CI/CD流水线中自动执行这些检查
3. 生成5S评审报告

**评审通过标准**:
- ✅ 必须通过的指标：100%通过
- ⚠️ 建议通过的指标：≥ 80%通过

**示例评审报告**:
```markdown
# VTest 5S评审报告

## 评审日期
2026-06-07

## 评审结果汇总

| 维度 | 检查项总数 | 通过数 | 通过率 | 状态 |
|------|------------|--------|--------|------|
| Standard | 20 | 20 | 100% | ✅ |
| Secure | 15 | 15 | 100% | ✅ |
| Scalable | 10 | 6 | 60% | ⚠️ |
| Stable | 12 | 12 | 100% | ✅ |
| Sustainable | 8 | 8 | 100% | ✅ |

## 详细结果

### Standard（标准）
✅ 所有检查项通过

### Secure（安全）
✅ 所有检查项通过

### Scalable（可扩展）
⚠️ 以下检查项未通过：
- SC01 水平扩展能力（⚠️ 建议）
- SC03 数据库扩展能力（⚠️ 建议）
- SC04 缓存机制（⚠️ 建议）
- SC06 消息队列（⚠️ 建议）

**建议**: MVP阶段可以先不支持水平扩展，但在架构设计上要预留扩展空间。

### Stable（稳定）
✅ 所有检查项通过

### Sustainable（可持续）
✅ 所有检查项通过

## 结论
✅ 可以进行MVP发布（Scalable维度的建议项可以在后续迭代中完善）
```

---

## 4. MVP验收测试方案

### 4.1 验收测试环境定义

#### 硬件环境

| 环境类型 | 用途 | 配置 |
|----------|------|------|
| **开发环境** | 开发和单元测试 | 开发者本地机器 |
| **测试环境** | 功能测试、集成测试、性能测试 | 见下方详细配置 |
| **预发布环境** | 用户验收测试 | 与生产环境一致 |
| **生产环境** | 正式发布 | 见下方详细配置 |

**测试环境详细配置**:
- **服务器**: 
  - CPU: Intel i7-11700K (8核16线程)
  - 内存: 32GB DDR4
  - 磁盘: 1TB NVMe SSD
  - 网络: 1Gbps以太网
- **测试设备**:
  - 真机: Pixel 6 (Android 12), 小米(Redmi Note 10) (Android 11)
  - 模拟器: Android 8.0, 10.0, 12.0, 14.0
- **软件**:
  - OS: Windows 11 / Ubuntu 22.04
  - Python: 3.11
  - Node.js: 18.x
  - ADB: 1.0.41
  - Android SDK: API 26-34

#### 软件环境

**依赖服务**:
- **数据库**: PostgreSQL 14 (用于存储任务和结果)
- **缓存**: Redis 7 (用于缓存APK解析结果、探索路径等)
- **消息队列**: RabbitMQ 3.11 (用于异步任务)
- **对象存储**: MinIO (用于存储APK文件、截图、报告等)

**第三方服务**:
- **Jira API**: 用于缺陷追踪集成测试（使用测试项目）
- **GitHub API**: 用于缺陷追踪集成测试（使用测试仓库）

#### 测试数据准备

**APK测试文件**:
- `valid_app.apk`: 合法的APK，12个Activity，用于功能测试
- `large_app.apk`: 大型APK (200MB), 50个Activity，用于性能测试
- `corrupted.apk`: 损坏的APK，用于异常测试
- `not_an_apk.txt`: 非APK文件，用于输入验证测试
- `app_with_native_libs.apk`: 包含原生库的APK，用于兼容性测试

**测试设备**:
- 见"兼容性测试"章节的设备矩阵

**测试账号**:
- 管理员账号: admin / admin123
- 普通用户账号: user / user123

---

### 4.2 验收测试用例（15个端到端场景）

#### 场景1: 完整工作流 - 小型App（P0）

**用例ID**: E2E-001  
**优先级**: P0  
**预计时间**: 20分钟

**步骤**:
1. 用户登录系统
2. 上传APK文件 (`valid_app.apk`, 12个Activity)
3. 等待APK解析完成（≤ 60秒）
4. 验证解析结果：
   - app_name: "VTestDemo"
   - package_name: "com.example.vtestdemo"
   - activities数量: 12
5. 点击"开始AI探索"
6. 等待AI探索完成（≤ 30分钟）
7. 验证探索结果：
   - 路径覆盖率 ≥ 85%
   - 生成路径数 ≥ 20条
8. 点击"生成测试用例"
9. 等待用例生成完成（≤ 5分钟）
10. 验证生成的用例：
    - 用例数 ≥ 20条
    - 格式正确性：100%
11. 选择所有用例，点击"开始执行"
12. 等待执行完成
13. 验证执行结果：
    - 执行成功率 ≥ 95%
14. 点击"生成报告"
15. 验证报告：
    - HTML报告能正常打开
    - 数据准确性：100%

**验收标准**: 所有步骤成功完成，每个阶段的量化指标达标。

---

#### 场景2: APK上传失败处理（P0）

**用例ID**: E2E-002  
**优先级**: P0  
**预计时间**: 5分钟

**步骤**:
1. 用户登录系统
2. 尝试上传非APK文件 (`not_an_apk.txt`)
3. 验证系统给出明确错误提示："不支持的文件格式，请上传.apk文件"
4. 尝试上传损坏的APK (`corrupted.apk`)
5. 验证系统给出明确错误提示："APK文件损坏，请重新上传"
6. 尝试上传超过500MB的APK
7. 验证系统给出明确错误提示："文件大小超过500MB限制"

**验收标准**: 所有异常输入都能给出明确的错误提示，系统不会崩溃。

---

#### 场景3: AI探索中断与恢复（P1）

**用例ID**: E2E-003  
**优先级**: P1  
**预计时间**: 40分钟

**步骤**:
1. 用户登录系统
2. 上传APK并解析成功
3. 点击"开始AI探索"
4. 等待5分钟（探索进行中）
5. 点击"暂停探索"
6. 验证探索暂停，状态显示为"paused"
7. 点击"继续探索"
8. 验证探索继续，状态显示为"running"
9. 等待探索完成
10. 验证探索结果完整（路径数、覆盖率等指标正常）

**验收标准**: 探索能正确暂停和继续，最终结果完整。

---

#### 场景4: 测试执行失败与重试（P1）

**用例ID**: E2E-004  
**优先级**: P1  
**预计时间**: 30分钟

**步骤**:
1. 准备一个包含不稳定测试用例的APK（某些用例有概率失败）
2. 完成APK解析、AI探索、用例生成
3. 执行测试
4. 验证系统能正确记录失败用例
5. 选择"失败重试"功能
6. 验证只有失败用例被重新执行
7. 验证重试结果正确更新

**验收标准**: 失败用例能被正确识别并重试，重试结果正确更新。

---

#### 场景5: 多设备并行执行（P2）

**用例ID**: E2E-005  
**优先级**: P2  
**预计时间**: 40分钟

**步骤**:
1. 连接3个测试设备（可以是真机或模拟器）
2. 完成APK解析、AI探索、用例生成
3. 选择3个设备，点击"并行执行"
4. 验证用例被均匀分配到3个设备
5. 等待所有设备执行完成
6. 验证汇总报告正确

**验收标准**: 用例能正确分配到多个设备，汇总报告正确。

---

#### 场景6: 报告导出与分享（P1）

**用例ID**: E2E-006  
**优先级**: P1  
**预计时间**: 10分钟

**步骤**:
1. 完成一个完整的测试执行
2. 点击"生成报告"
3. 选择导出格式：HTML
4. 验证HTML报告能正常打开，内容完整
5. 选择导出格式：PDF
6. 验证PDF报告能正常打开，内容完整
7. 选择导出格式：JUnit XML
8. 验证XML文件能被Jenkins解析
9. 点击"分享报告"
10. 验证生成分享链接，有效期7天

**验收标准**: 所有格式都能正确导出，分享功能正常。

---

#### 场景7: 缺陷追踪集成（P2）

**用例ID**: E2E-007  
**优先级**: P2  
**预计时间**: 20分钟

**步骤**:
1. 配置Jira API凭据
2. 完成一个测试执行，确保有失败用例
3. 选择失败用例，点击"创建缺陷"
4. 验证系统自动填充缺陷信息（标题、描述、复现步骤、截图等）
5. 点击"提交到Jira"
6. 验证Jira中成功创建缺陷
7. 验证缺陷ID回写到VTest系统
8. 在VTest系统中点击缺陷ID链接
9. 验证能跳转到Jira的缺陷页面

**验收标准**: 缺陷能成功创建到Jira，信息完整，双向链接正常。

---

#### 场景8: 性能基准测试（P0）

**用例ID**: E2E-008  
**优先级**: P0  
**预计时间**: 60分钟

**步骤**:
1. 准备3个测试APK（小、中、大）
2. 分别执行完整工作流
3. 记录每个阶段的性能指标：
   - APK解析时间
   - AI探索时间
   - 用例生成时间
   - 测试执行时间
   - 报告生成时间
4. 验证所有指标符合US-01~US-05的量化标准

**验收标准**: 所有性能指标达标。

---

#### 场景9: 兼容性测试（P0）

**用例ID**: E2E-009  
**优先级**: P0  
**预计时间**: 120分钟

**步骤**:
1. 准备4个测试设备（Android 8.0, 10.0, 12.0, 14.0）
2. 在每个设备上执行完整工作流
3. 记录每个设备的兼容性指标：
   - APK安装成功率
   - AI探索成功率
   - 测试执行成功率
   - 覆盖率
4. 验证所有指标符合兼容性测试矩阵的标准

**验收标准**: 所有Android版本都能正常运行，覆盖率误差 ≤ 10%。

---

#### 场景10: 长时间稳定性测试（P1）

**用例ID**: E2E-010  
**优先级**: P1  
**预计时间**: 24小时（可缩短为2小时用于验收）

**步骤**:
1. 启动VTest系统
2. 每隔1小时执行一次完整工作流（使用小型APK）
3. 持续24小时
4. 记录：
   - 系统是否崩溃
   - 内存使用量是否持续增长
   - CPU使用率（空闲时）
5. 验证系统稳定性

**验收标准**: 
- 崩溃次数 = 0
- 内存使用量增长 ≤ 10%
- 空闲时CPU使用率 ≤ 5%

---

#### 场景11: 并发用户测试（P1）

**用例ID**: E2E-011  
**优先级**: P1  
**预计时间**: 30分钟

**步骤**:
1. 准备10个测试用户账号
2. 使用自动化脚本模拟10个用户同时登录
3. 每个用户执行完整工作流（使用小型APK）
4. 验证：
   - 所有用户都能成功登录
   - 每个用户的工作流互不干扰
   - 系统响应时间在正常范围内

**验收标准**: 10个并发用户都能正常使用系统，响应时间增长 ≤ 50%。

---

#### 场景12: 数据备份与恢复（P1）

**用例ID**: E2E-012  
**优先级**: P1  
**预计时间**: 15分钟

**步骤**:
1. 执行一个完整工作流，生成测试数据
2. 执行数据备份
3. 验证备份文件生成
4. 删除数据库中的数据
5. 执行数据恢复
6. 验证数据完全恢复
7. 验证恢复后系统能正常使用

**验收标准**: 数据能成功备份和恢复，恢复后系统正常。

---

#### 场景13: API接口测试（P0）

**用例ID**: E2E-013  
**优先级**: P0  
**预计时间**: 30分钟

**步骤**:
1. 使用Postman或类似工具
2. 测试所有REST API接口（见"接口测试"章节）
3. 验证：
   - 请求格式正确性
   - 响应格式正确性
   - 错误处理正确性
   - 认证和权限控制
4. 记录测试结果

**验收标准**: 所有API接口都能正常工作，覆盖率100%。

---

#### 场景14: 安全渗透测试（P0）

**用例ID**: E2E-014  
**优先级**: P0  
**预计时间**: 60分钟

**步骤**:
1. 使用OWASP ZAP或类似工具
2. 对VTest系统进行安全扫描
3. 检查：
   - SQL注入
   - XSS
   - CSRF
   - 路径遍历
   - 认证绕过
4. 验证所有安全漏洞都被修复

**验收标准**: 没有高危和中危安全漏洞。

---

#### 场景15: 用户体验测试（P2）

**用例ID**: E2E-015  
**优先级**: P2  
**预计时间**: 30分钟

**步骤**:
1. 邀请5个真实用户（非开发团队）
2. 给他们分配任务：
   - 上传一个APK
   - 执行AI探索
   - 查看测试报告
3. 观察他们的操作，记录：
   - 是否容易上手
   - 是否有困惑的地方
   - 操作是否直观
4. 收集反馈

**验收标准**: 
- 80%的任务能独立完成
- 用户满意度 ≥ 4/5

---

### 4.3 验收通过/不通过的明确标准

#### 必须通过的标准（P0）

**功能完整性**:
- ✅ US-01~US-06的所有P0功能都能正常工作
- ✅ 所有端到端场景（E2E-001, E2E-002, E2E-008, E2E-009, E2E-013, E2E-014）通过
- ✅ 所有量化指标达标（见US-01~US-06）

**性能要求**:
- ✅ APK解析时间（中等App） ≤ 60秒
- ✅ AI探索时间（中等App） ≤ 30分钟
- ✅ 测试执行速度 ≤ 20秒/用例
- ✅ 报告生成时间 ≤ 30秒

**兼容性要求**:
- ✅ Android 8.0, 10.0, 12.0, 14.0都能正常运行
- ✅ 真机和模拟器都能正常使用

**稳定性要求**:
- ✅ 长时间运行（7天）无崩溃
- ✅ 内存使用量无持续增长
- ✅ 所有异常都有正确处理

**安全要求**:
- ✅ 通过安全渗透测试，没有高危和中危漏洞
- ✅ 所有API都有认证和权限控制
- ✅ 敏感数据加密存储

**代码质量要求**:
- ✅ 单元测试覆盖率 ≥ 80%
- ✅ 所有P0功能的集成测试通过
- ✅ 代码符合编码规范（flake8 0错误）

#### 建议通过的标准（P1/P2）

**功能完整性**:
- ⚠️ US-01~US-06的所有P1功能都能正常工作
- ⚠️ 端到端场景E2E-003, E2E-004, E2E-006, E2E-010, E2E-011通过

**性能要求**:
- ⚠️ APK解析时间（大型App） ≤ 180秒
- ⚠️ AI探索时间（大型App） ≤ 60分钟

**扩展性要求**:
- ⚠️ 支持水平扩展（或架构上预留扩展空间）
- ⚠️ 支持缓存机制

**用户体验要求**:
- ⚠️ 用户满意度 ≥ 4/5
- ⚠️ 80%的任务能独立完成

#### 验收结论

**通过条件**:
- ✅ 所有P0标准都通过 → **可以发布MVP**
- ⚠️ P0标准通过，但P1/P2标准有部分未通过 → **可以发布MVP，但需要在后续迭代中完善**
- ❌ P0标准有未通过的 → **不能发布MVP，必须先修复**

**示例验收报告**:
```markdown
# VTest MVP验收报告

## 验收日期
2026-06-07

## 验收结果

### P0标准（必须通过）
| 检查项 | 状态 | 说明 |
|--------|------|------|
| 功能完整性 | ✅ | 所有P0功能正常 |
| 性能要求 | ✅ | 所有性能指标达标 |
| 兼容性要求 | ✅ | Android 8.0~14.0都通过 |
| 稳定性要求 | ✅ | 7天稳定性测试通过 |
| 安全要求 | ✅ | 安全渗透测试通过 |
| 代码质量要求 | ✅ | 测试覆盖率85% |

### P1/P2标准（建议通过）
| 检查项 | 状态 | 说明 |
|--------|------|------|
| 功能完整性 | ⚠️ | E2E-005（多设备并行）未通过 |
| 扩展性要求 | ⚠️ | 水平扩展未实现 |
| 用户体验要求 | ✅ | 用户满意度4.2/5 |

## 结论
✅ **可以发布MVP**

**未通过项**:
- E2E-005 多设备并行执行：当前只支持单设备执行，多设备并行功能需要后续迭代完善
- 水平扩展：当前只支持单实例部署，需要在架构上增加负载均衡支持

**建议**:
1. 在下一个迭代中实现多设备并行执行功能
2. 在架构设计上预留水平扩展空间，后续实现负载均衡

## 签字
- QA-Lead: _______________ 日期: 2026-06-07
- 技术负责人: _______________ 日期: 2026-06-07
- 产品经理: _______________ 日期: 2026-06-07
```

---

## 5. 附录：测试数据准备

### 5.1 APK测试文件清单

| 文件名 | 描述 | 大小 | Activity数 | 用途 |
|--------|------|------|------------|------|
| valid_app.apk | 合法的APK | 15MB | 12 | 功能测试 |
| large_app.apk | 大型APK | 200MB | 50 | 性能测试 |
| corrupted.apk | 损坏的APK | 10MB | - | 异常测试 |
| not_an_apk.txt | 非APK文件 | 1KB | - | 输入验证测试 |
| app_with_native_libs.apk | 包含原生库的APK | 25MB | 8 | 兼容性测试 |
| app_with_network_deps.apk | 依赖网络的APK | 12MB | 10 | 网络异常测试 |
| app_with_crash.apk | 会崩溃的APK | 8MB | 5 | 稳定性测试 |

### 5.2 测试设备清单

| 设备名称 | 类型 | Android版本 | 分辨率 | CPU架构 | 用途 |
|----------|------|-------------|--------|---------|------|
| Pixel 6 | 真机 | 12 | 1080x2400 | arm64-v8a | 主流设备测试 |
| 小米Redmi Note 10 | 真机 | 11 | 1080x2400 | arm64-v8a | 国产设备测试 |
| 低分辨率手机 | 真机 | 10 | 720x1280 | armeabi-v7a | 低分辨率测试 |
| Android 8.0 模拟器 | 模拟器 | 8.0 | 1080x1920 | x86_64 | 旧版本兼容性测试 |
| Android 14.0 模拟器 | 模拟器 | 14.0 | 1080x1920 | x86_64 | 新版本兼容性测试 |

### 5.3 测试账号清单

| 用户名 | 密码 | 角色 | 用途 |
|--------|------|------|------|
| admin | admin123 | 管理员 | 系统管理功能测试 |
| user1 | user123 | 普通用户 | 常规功能测试 |
| user2 | user123 | 普通用户 | 并发测试 |

---

## 总结

本文档定义了VTest MVP的可量化验收标准，包括：

1. **用户故事量化验收标准**: 为US-01~US-06的每个用户故事定义了清晰的输入条件、操作步骤、预期输出和量化指标，确保所有功能都可验证。

2. **测试类型与优先级矩阵**: 定义了功能测试、性能测试、接口测试、兼容性测试、集成测试的覆盖范围和优先级，确保测试全面且有重点。

3. **5S评审检查清单**: 提供了65个具体的检查项（Standard 20项、Secure 15项、Scalable 10项、Stable 12项、Sustainable 8项），可用于自动检查，确保系统质量。

4. **MVP验收测试方案**: 定义了15个端到端测试场景和明确的验收通过/不通过标准，确保MVP质量可达标。

所有标准都是**可量化的**、**可自动验证的**，开发团队可以按图索骥执行测试。

---

**文档版本历史**:
- v1.0 (2026-06-07): 首次创建
