# 发布流程

当前 0.1.0 为本地试用包，发布仓库和插件市场尚未配置。

1. 运行 `npm ci`、`npm run lint:check`、`npm test`、`npm run build`、`npm run verify:package`。
2. 用 Zotero 9.0.6 运行 `npm run test:zotero`，检查离线验收结果和截图。
3. 人工检查系统文件选择器的备份导出 / 导入、鼠标裁剪与抽屉拖动、不同 DPI、卸载重装，以及原生 Reader 阅读。
4. 配置实际开源仓库：修改 `package.json` 的 `repository.url`，确认作者与版权信息。占位仓库只供脚手架构建使用，不能用于发布。
5. 设置 `ZCL_UPDATE_URL` 和 `ZCL_XPI_DOWNLOAD_URL` 为正式更新清单和 XPI 下载链接后重新构建。Zotero 9 强制要求更新地址；默认保留域名不会提供在线更新。
6. 检查 XPI 中的 `manifest.json`、`LICENSE`、`NOTICE`、`README.md`、`docs/PRIVACY.md`、`BUILD.json`。只有在干净提交上构建的包才作为正式发布产物。
7. 经维护者决定后推送版本标签。仓库的 Release workflow 会构建并上传 XPI 与源码归档；没有自动进行本地发布。

GitHub Secrets / Variables 和仓库设置属于维护者配置。申请插件市场收录前应核对届时的收录规则，不宣称已获得市场审核。

依赖审核使用 `npm audit`；生产包不捆绑 npm 依赖，构建和测试依赖仍需跟踪安全更新。不要在未经验证时执行 `npm audit fix --force`。
