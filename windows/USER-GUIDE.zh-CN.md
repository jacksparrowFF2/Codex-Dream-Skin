# EVA Dream Skin 安装与使用手册

本文适用于本仓库当前的 Windows 版 Codex Dream Skin，以及绫波丽、真希波、明日香和双人 EVA 预设。主题通过本机回环 CDP 加载到 Microsoft Store 版 Codex，不修改 `WindowsApps`、`app.asar`、应用签名、会话或登录信息。

## 1. 运行要求

- Windows 10/11，并已从 Microsoft Store 安装官方 `OpenAI.Codex`。
- Node.js 22 或更高版本；在 PowerShell 中运行 `node --version` 可以看到版本号。
- Windows PowerShell 5.1 或更高版本。
- 安装或更新前，完全退出 Codex 和 `Codex Dream Skin` 托盘程序。

普通安装不需要管理员权限。不要修改或接管 `WindowsApps` 目录。

## 2. 首次安装

在本仓库根目录打开 PowerShell，依次运行：

```powershell
# 安装 Dream Skin 引擎、快捷方式和托盘程序
powershell.exe -NoProfile -ExecutionPolicy Bypass -File `
  .\Codex-Dream-Skin\windows\scripts\install-dream-skin.ps1

# 安装四个 EVA 预设主题
powershell.exe -NoProfile -ExecutionPolicy Bypass -File `
  .\themes\preset-eva-rei-mari\install-theme.ps1
```

安装器会在 `%LOCALAPPDATA%\CodexDreamSkin\engine` 建立独立运行副本，并在桌面和开始菜单创建：

- `Codex Dream Skin`：以主题模式启动 Codex。
- `Codex Dream Skin - Tray`：打开主题控制托盘。
- `Codex Dream Skin - Restore`：恢复官方外观并关闭主题会话。

如默认端口被占用，启动器会自动寻找空闲端口。只有需要固定端口时才在安装命令后添加 `-Port 9444`。

## 3. 启动与选择角色主题

1. 双击 `Codex Dream Skin - Tray`，确认系统托盘出现图标。
2. 右键托盘图标，展开“已保存主题”。
3. 选择需要的预设：

| 主题 | 主色 | 壁纸与定位 |
|---|---|---|
| EVA · 绫波丽 · 冰蓝同步 | 冰蓝 | 日常针织装，零号机风格 |
| EVA · 真希波 · 紫色同步 | 紫色 | 日常贝雷帽与格纹装，八号机风格 |
| EVA · 明日香 · 红黄同步 | 红、金黄 | 秋日便装，二号机风格 |
| EVA · 凌波丽 × 真希波 | 粉蓝 | 原始双人预设（为兼容保留） |

4. 双击 `Codex Dream Skin`。如果 Codex 已打开，按提示允许重启。

角色预设的 `appearance` 为 `auto`，会跟随 Codex 的深色/浅色外观，同时保留各角色的独立配色。若直接从普通 Codex 快捷方式启动，主题不会加载。

## 4. 托盘菜单说明

| 菜单项 | 用途 |
|---|---|
| 应用或重新应用 | 启动 Codex，或在主题失效后重新注入 |
| 暂停皮肤 / 继续显示皮肤 | 临时关闭或恢复装饰，不删除配置 |
| 更换背景图 | 导入 PNG、JPEG 或 WebP 纯壁纸 |
| 保存当前主题 | 将当前壁纸和配置保存为新预设 |
| 已保存主题 | 在 EVA 角色主题及自定义主题之间切换 |
| 打开图片文件夹 | 查看已导入的背景素材 |
| 完全恢复 Codex | 移除主题效果并恢复官方外观 |
| 退出托盘 | 退出托盘控制程序，不等同于卸载 |

导入的图片不得超过 16 MB，单边不得超过 16384 像素，总像素不得超过 5000 万。建议使用 16:9、人物位于右侧、左侧留出文字安全区的无 UI 壁纸；不要导入带窗口、按钮、文字或水印的截图。

## 5. MAGI 监控面板

右侧环境信息顶部的 MAGI 面板读取 Codex 当前页面和原生状态缓存，只做本地显示，不发送额外消息或用量查询。

| 指标 | 含义 |
|---|---|
| MELCHIOR 1 · ONLINE | Dream Skin 已连接当前 Codex 界面 |
| BALTHASAR 2 · CLEAN | 当前变更区没有未提交改动 |
| BALTHASAR 2 · DIRTY | Git 工作区存在尚未提交的新增、修改或删除 |
| BALTHASAR 2 · CHECK | 当前页面没有足够信息判断 Git 状态 |
| CASPER 3 · READY / RUN / HOLD | 任务待命、执行中或等待状态 |
| 7D USAGE REMAINING | Codex 原生 7 天限额的剩余百分比和重置日期 |
| CONTEXT REMAINING | 当前会话上下文窗口剩余比例、已用和总容量 |

数据标签含义：`AUTO` 表示从 Codex 原生状态自动读取，`LAST` 表示显示最近一次有效缓存，`EST.` 表示无法获得官方上下文数据时的页面估算，`CHECK` 表示暂时不可用。主题约每 5 秒采样一次；7 天限额的实际变化频率仍由 Codex 自身的状态缓存决定。切换会话后，面板只会把上下文数据用于匹配的会话。

侧栏当前任务后的 `SYNC 5/5` 表示待命，`SYNC 3/5` 表示执行中，`SYNC 4/5` 表示等待；它是任务状态提示，不是账户额度。

## 6. 更新、验证与修复

Codex 或本仓库更新后，先退出托盘和 Codex，再重新运行第 2 节的两个安装命令。安装器会重新发现当前 Store 包并更新托管引擎，已保存主题仍保留。

需要验证时运行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File `
  .\Codex-Dream-Skin\windows\scripts\verify-dream-skin.ps1 `
  -ScreenshotPath "$env:TEMP\codex-dream-skin.png"
```

验证后请同时检查首页和普通任务页：壁纸是否连续、输入框是否完整、侧栏/右栏滚动条是否错位、菜单是否可读，以及浅色和深色模式的对比度。

## 7. 常见问题

### 主题没有生效或切换边栏后消失

确认是通过 `Codex Dream Skin` 启动；在托盘中选择“应用或重新应用”。仍未恢复时，退出 Codex 和托盘后重新安装引擎。

### MAGI 显示 CHECK、LAST 或 EST.

先进入一个正常会话并等待数秒。`LAST` 说明 Codex 尚未刷新原生限额缓存；`EST.` 说明当前会话的官方 token 数据尚不可用。通常无需手动发送“查询状态”。

### 安装器提示 Codex 或托盘仍在运行

关闭所有 Codex 窗口，并从托盘菜单选择“退出托盘”，然后重新运行安装命令。不要强行覆盖正在使用的运行目录。

### 找不到 Node.js 或官方 Codex

```powershell
node --version
Get-AppxPackage -Name OpenAI.Codex
```

Node.js 必须为 22 或更高版本；重新安装 Node.js 后应新开一个 PowerShell 窗口。

## 8. 恢复与卸载

仅恢复官方外观并关闭主题会话：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File `
  .\Codex-Dream-Skin\windows\scripts\restore-dream-skin.ps1 `
  -RestoreBaseTheme -PromptRestart
```

同时删除 Dream Skin 创建的快捷方式：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File `
  .\Codex-Dream-Skin\windows\scripts\restore-dream-skin.ps1 `
  -RestoreBaseTheme -PromptRestart -Uninstall
```

`-RecoverConfigBackup` 只用于 `config.toml` 已损坏且普通恢复无效的情况，不要与 `-RestoreBaseTheme` 同时使用。

## 9. 数据与日志位置

| 内容 | 路径 |
|---|---|
| 托管引擎 | `%LOCALAPPDATA%\CodexDreamSkin\engine` |
| 当前主题 | `%LOCALAPPDATA%\CodexDreamSkin\active-theme` |
| 已保存主题 | `%LOCALAPPDATA%\CodexDreamSkin\themes` |
| 导入图片 | `%LOCALAPPDATA%\CodexDreamSkin\images` |
| 运行状态 | `%LOCALAPPDATA%\CodexDreamSkin\state.json` |
| 运行日志 | `%LOCALAPPDATA%\CodexDreamSkin\injector.log` |
| 错误日志 | `%LOCALAPPDATA%\CodexDreamSkin\injector-error.log` |

日志或截图可能包含本机路径、项目名和会话画面。分享排错材料前，请删除密钥、账户信息和私人对话内容。
