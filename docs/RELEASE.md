# 发布流程

当前版本为 0.1.3，源代码仓库为 `Ausanx/zotero-card-library`。插件市场条目由 [Zotero Add-on Market 数据源](https://github.com/syt2/zotero-addons-scraper) 收录。

1. 运行 `npm ci`、`npm run lint:check`、`npm test`、`npm run build`、`npm run verify:package`。
2. 用 Zotero 9.0.6 运行 `npm run test:zotero`，检查离线验收结果和截图。
3. 人工检查系统文件选择器的备份导出 / 导入、鼠标裁剪与独立详情窗口缩放、不同 DPI、卸载重装，以及原生 Reader 阅读。
4. 确认 `package.json` 的仓库地址，以及 XPI `manifest.json` 和 `update.json` 的下载地址都指向正式 GitHub Releases。
5. `npm run verify:package` 会核对最终 XPI 与 `update.json`、`update-beta.json` 的 SHA-512。Zotero 9 要求更新地址，正式版本不得使用占位域名。
6. 检查 XPI 中的 `manifest.json`、`LICENSE`、`NOTICE`、`README.md`、`docs/PRIVACY.md`、`BUILD.json`。只有在干净提交上构建的包才作为正式发布产物。
7. 推送版本标签后，Release workflow 构建并上传 XPI、源码归档和更新清单。版本 Release 标为 Latest；仅供 Zotero 更新清单使用的 `release` 标为 prerelease。检查下载地址，再向插件市场数据源提交 `{owner}@{repo}` 条目。

插件市场由第三方维护，提交条目后仍需等待维护者合并；不把提交视为已收录。

依赖审核使用 `npm audit`；生产包不捆绑 npm 依赖，构建和测试依赖仍需跟踪安全更新。不要在未经验证时执行 `npm audit fix --force`。
