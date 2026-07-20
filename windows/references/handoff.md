# Windows 开发交接

更新时间：2026-07-20（Asia/Shanghai）

## 仓库与分支

- 当前工作仓库是派生引擎 `Codex-Dream-Skin-self`，不是外层主题仓库 `CodexSkin`。
- 派生仓库分支：`main`，当前基线为 `8860416`（`Exclude native header from .dream-task layering`），与 `origin/main` 一致。
- `origin`：`https://github.com/jacksparrowFF2/Codex-Dream-Skin.git`
- `upstream`：`https://github.com/Fei-Away/Codex-Dream-Skin.git`
- 上游合并前备份分支：`codex/backup-before-upstream-merge`，指向 `43beab3`。
- 外层 `CodexSkin` 仓库不会跟踪 `Codex-Dream-Skin-self/`。在另一台电脑上应单独克隆派生引擎仓库，不能只克隆外层主题仓库。

## 当前目标

增加一条安全的 Windows 工作流：先把当前源码热注入正在运行且已验证的 Dream Skin 会话，用户视觉确认后，再通过正式安装器更新 `%LOCALAPPDATA%\CodexDreamSkin\engine`，关闭并重新启动 Codex。取消确认时仅保留本次会话预览，不修改受管运行时。

## 尚未提交的改动

- `windows/scripts/preview-and-install-dream-skin.ps1`：新增热预览、确认、短时 approval token、独立隐藏部署助手、正式安装与可选重启流程。
- `windows/scripts/common-windows.ps1`：把 `Stop-DreamSkinTrayProcess` 提升为共享助手。
- `windows/scripts/restore-dream-skin.ps1`：删除重复的托盘停止函数，改用共享实现。
- `windows/tests/run-tests.ps1`：增加预览后安装流程的静态安全和顺序断言。
- `windows/README.md`、`windows/README.en.md`：增加中英文使用说明。
- 本文件记录交接状态。

不要直接编辑 `%LOCALAPPDATA%\CodexDreamSkin\engine`；该目录只能由正式安装器替换。

## 已完成验证

在 2026-07-20 从派生仓库根目录运行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\windows\tests\run-tests.ps1
node --check .\windows\scripts\injector.mjs
node --check .\windows\assets\renderer-inject.js
```

结果：完整 Windows 回归通过，输出以 `PASS: config transactions, restore scoping, state safety, argument quoting, and loopback CDP validation.` 结束；两个 Node 语法检查通过。新增及受影响的 PowerShell 文件也已使用 PowerShell Parser 检查，未发现语法错误。

回归测试会故意触发若干清理失败路径，因此出现 `forced ... cleanup failure` 警告是预期测试输出。受限沙箱内直接运行曾因系统临时目录权限失败，改在正常 Windows 权限下运行后通过；这不是产品代码失败。

## 下一步

1. 先查看 `git status --short --branch` 和 `git diff --check`，确认只有上述文件发生变化。
2. 完全退出旧的 Dream Skin 托盘和 Codex，按正常安装流程确保活动运行时来自当前派生仓库。
3. 从 Dream Skin 快捷方式启动 Codex，确保已有已验证的 live session。
4. 在 `windows` 目录运行：

   ```powershell
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\preview-and-install-dream-skin.ps1
   ```

5. 确认热预览后的首页、普通任务页、侧边栏、项目选择器、composer、菜单及弹窗均正常；先选择“否”验证受管运行时未被更新。
6. 再次运行并选择“是”，确认 Codex 与托盘被关闭、正式安装成功、Codex 自动重启；检查 `%LOCALAPPDATA%\CodexDreamSkin\deploy-update.log`。
7. 运行 `windows/scripts/verify-dream-skin.ps1` 并按 `windows/references/qa-inventory.md` 完成 live Windows signoff。还需确认未发送的 composer 内容风险提示准确。
8. 若人工验收通过，再以短命令式提交信息提交这些改动并推送到派生仓库 `origin/main`。提交和推送尚未执行。

## 失败恢复与注意事项

- 部署开始后若失败，助手会记录部署日志，并在可能时重新打开官方 Codex；首先查看 `deploy-update.log`，不要手工修补受管运行时。
- approval 文件位于 `%LOCALAPPDATA%\CodexDreamSkin`，只接受匹配当前源码目录、匹配 token 且五分钟内创建的记录，读取后会删除。
- `-NoRelaunch` 仅用于显式需要部署后不重启的场景；默认应验证自动重启。
- 若没有已验证的 live session，先从 Dream Skin 快捷方式启动；不要绕过 session、Browser ID、端口或 Store 包身份检查。
- 如果另一台电脑看不到本次未提交改动，说明它们还没有经 Git 传输。先在本机提交并推送，或生成并安全复制补丁；仅凭本文件无法重建未提交源码。
