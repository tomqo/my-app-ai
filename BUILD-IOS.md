# AI Chat PWA → iOS IPA

## 一键云编译步骤

### 1. 创建 GitHub 仓库
- 打开 https://github.com/new
- 仓库名填 `my-app-ai`，选 Private
- 不要勾选 README（保持空仓库）

### 2. 推送代码
在项目目录执行：
```bash
git init
git add .
git commit -m "init"
git branch -M main
git remote add origin https://github.com/你的用户名/my-app-ai.git
git push -u origin main
```

### 3. 触发编译
- 打开仓库页面 → Actions 标签
- 如果提示 "Workflows aren't being run"，点 "I understand my workflows, go ahead and enable them"
- 点左侧 **Build iOS IPA** → 右上角 **Run workflow** → Run
- 等 3-5 分钟，完成后在 Artifacts 下载 `AI-Chat-IPA`

### 4. 安装到 iPhone
下载的 `AI-Chat.ipa` 是未签名包，用以下任一方式安装：
- **AltStore**（推荐）：电脑装 AltServer，手机连同一 WiFi，通过 WiFi 安装
- **Sideloadly**：手机连数据线，用 Apple ID 签名安装
- **TrollStore**（iOS 15-17）：直接安装无需电脑

> 注意：未签名 IPA 7 天后过期（AltStore 会自动续签）。
> 如果有 Apple Developer 账号（$99/年），可以配置签名变成永久安装。
