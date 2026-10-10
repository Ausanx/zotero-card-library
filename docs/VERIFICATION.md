# 0.1.3 验证记录

2026-10-10，Windows，本机 Zotero 9.0.6，独立 headless profile，238 条合成文献及本地合成 PDF。

- `npm test`：61 项通过；`npm run lint:check`：Prettier、ESLint 通过。
- `npm run build`、`npm run verify:package`：类型检查及 0.1.3 XPI 校验通过。
- `npm run test:zotero`：47 项原生验收断言通过；结果目录 `.scaffold/zotero-test-1791611703365/`。

人工查看主窗口、详情窗口和深色主题截图：灰蓝色背景、淡蓝紫默认卡片、浅青绿色已读卡片、蓝色主操作和侧栏选中态均显示正常；卡片圆角、内描边、阴影和按钮布局保持清晰。用户自定义的单卡颜色与颜色规则仍按现有优先级应用。

# 0.1.2 验证记录

2026-10-10，Windows，本机 Zotero 9.0.6，独立 headless profile，238 条合成文献及本地合成 PDF。

- `npm test`：61 项纯逻辑 / DOM 测试通过。新增回归测试先复现简记漏读、详情自动生成候选、命中封面缓存仍打开 PDF，以及单卡操作重建其他卡片的问题，再验证修复。
- `npm run lint:check`：Prettier、ESLint 通过。
- `npm run build`、`npm run verify:package`：类型检查及 XPI 校验通过。
- `npm run test:zotero`：47 项原生验收断言通过；结果目录 `.scaffold/zotero-test-1791562504959/`。

新增原生验收确认 PDF.js 使用真实后台 Worker，详情元数据可以独立于候选图生成显示，Extra 中的 `remark:` 和旧版带 `remark` 标签的子笔记无需字段映射即可读取。子笔记 HTML 实体正确解码并保留段落换行。既有封面、手动裁剪、附件切换、主题和窗口生命周期验收通过。

已人工查看主窗口和详情截图，简记、按需加载候选按钮和卡片布局显示正常。性能结论依据任务线程、缓存和重绘行为的回归验证；尚未测量用户真实复杂 PDF 库的滚动帧率或点击延迟，首次生成封面仍需处理 PDF。

# 0.1.1 验证记录

2026-10-09，Windows，本机 Zotero 9.0.6，独立 headless profile，238 条合成文献及本地合成 PDF。没有访问真实用户文献库。

- `npm test`：57 项纯逻辑 / DOM 测试通过。
- `npm run lint:check`：Prettier、ESLint 通过。
- `npm run build`、`npm run verify:package`：类型检查、独立详情页面、XPI 版本 / 权限 / 来源检查通过。
- `npm run test:zotero`：43 项原生验收断言通过；结果目录 `.scaffold/zotero-test-1791556516425/`。

原生验收覆盖独立详情窗口的打开、复用、文献切换、关闭与重开、主板宽度保持不变、主窗口关闭后的详情清理、阅读状态和颜色控件同步、命名规则颜色、恢复规则颜色、中间色小字对比度、详情错误提示、深浅主题同步，以及既有候选封面、首页回退、手动裁剪、多 PDF 来源、原生 Reader、收藏、合集、备份和插件生命周期。

已人工查看同目录的 `screenshot.png`、`detail.png`、`compact.png` 和 `dark.png`。色卡、图片与按钮并排布局和详情中的颜色控件显示正常，没有发现文本遮挡或按钮溢出。

构建时 SWC 默认缓存目录的 ACL 被原生绑定拒绝；本轮通过进程级 `SWC_NATIVE_BINDING_CACHE=C:\Users\Ausan\.codex\native-swc-cache` 指定独立缓存，并以 `NODE_OPTIONS=--use-system-ca` 构建。没有改变依赖版本或原缓存权限。首次 headless 启动在验收驱动执行前因图形通道退出；新建测试 profile 重试后全部通过。

备份恢复使用注入的文件适配器，裁剪使用比例坐标；系统文件选择器、实际鼠标 / 不同 DPI、真实扫描版与复杂多页论文和未来 Zotero 升级仍需人工检查。所有测试数据均在本地生成，未上传本地文件数据。

独立审查及修复记录见 [REVIEW.md](REVIEW.md)。

# 0.1.0 验证记录

2026-10-09，Windows，本机 Zotero 9.0.6，独立 headless profile，238 条合成文献及本地合成 PDF。没有访问真实用户文献库。

- `npm test`：52 项纯逻辑 / DOM 测试通过。
- `npm run lint:check`：Prettier、ESLint 通过。
- `npm run build`、`npm run verify:package`：类型检查、XPI 文件及版本 / 权限 / 来源检查通过。
- `npm audit`：0 项已知漏洞。
- `npm run test:zotero`：29 项原生验收断言通过；结果目录 `.scaffold/zotero-test-1791552246727/`。

原生验收覆盖：插件初始化，238 卡片，单窗口复用，合集筛选，内部 Figure 候选及首页回退，缺失 linked PDF，原生 Reader 打开，阅读通知状态，候选 / 手动裁剪 / 多 PDF 来源保存，收藏，条目更新，新建条目刷新，批量加入合集，备份校验恢复，主题切换，详情抽屉不遮挡卡片与宽度保存，窗口重开，禁用、启用和卸载后文献 / PDF 保留。截图已人工查看，未发现文本遮挡或抽屉覆盖卡片。

备份恢复通过替换文件选择适配器输入的方式验证，未自动操作系统文件选择器。鼠标拖动采用坐标和键盘路径等价验证，尚未覆盖不同 DPI、真实扫描版 / 多页复杂论文、系统保存对话框和 Zotero 升级。复杂 Figure 检测仍可能需要手动框选；这些是试用包的验证边界。

独立审查及修复记录见 [REVIEW.md](REVIEW.md)。
