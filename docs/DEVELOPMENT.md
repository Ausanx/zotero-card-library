# 开发与验证

## 环境

Node.js 22.8+、npm、Zotero 9.0.6。运行 `npm ci`，依次执行 `npm test`、`npm run lint:check`、`npm run build`、`npm run verify:package`。

`src/zotero/` 隔离 Zotero 元数据接口，`src/data/` 管理状态校验和原子保存，`src/covers/` 处理图注规则、PDF.js 渲染和缓存，`src/ui/` 只消费 DTO，`src/window/` 和 `src/bootstrap/` 管理窗口与生命周期。运行时直接复用 Zotero 已安装的 PDF.js，不捆绑额外 PDF.js 或 toolkit。

## 开发 profile

复制 `.env.example` 为 `.env`，配置脚手架的 Zotero 程序、专用 profile 和数据目录，再运行 `npm start`。不要将日常文献库设为开发数据目录。`npm start` 的热重载过程可重启开发 Zotero；先关闭日常实例。

## 离线实机验收

设置 `ZOTERO_BIN` 后运行 `npm run test:zotero`。Windows 默认路径为 `D:/Program Files/Zotero/zotero.exe`。脚本在 `.scaffold/zotero-test-时间戳/` 创建 profile、数据目录、238 条合成条目与本地 PDF，安装构建的原始 XPI 和单独的测试驱动 XPI，以 headless 模式启动并切换离线状态。

结果在 `result.json`，日志在 `process.log`，可用的原生窗口截图在 `screenshot.png`。脚本不会上传这些文件或使用日常 Zotero profile。测试结束只关闭它创建的测试进程。headless 验收不替代实际 DPI、鼠标拖动和系统文件选择器的人工检查。

合成 PDF 生成器位于 `tests/fixtures/generate-pdfs.mjs`，包含单 Figure、双栏及无 Figure 场景。纯逻辑与 jsdom 测试可以独立于 Zotero 运行。

## 许可证

原创插件代码采用 MIT。开发工具及保留的模板配置遵守 NOTICE 中列出的上游许可证；请勿将 AGPL 模板运行时代码复制进 MIT 运行时。

## Windows SWC 缓存

新版本 SWC 会校验原生缓存目录的 Windows ACL。若构建报告 `ERR_SWC_NATIVE_CACHE`，将 `SWC_NATIVE_BINDING_CACHE` 指向仅当前用户、SYSTEM 和 Administrators 可写的专用目录。本次验证使用 `C:\Users\Ausan\zcl-swc-cache`；不要放宽系统目录权限或关闭校验。CI 的 Linux 环境不需要此设置。
