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
