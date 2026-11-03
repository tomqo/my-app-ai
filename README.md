# AI Chat — BYOK 通用 AI 聊天前端

一个 **零构建、纯前端** 的通用 AI 聊天 App（PWA）。自带 API Key，直连任意 **OpenAI 兼容端点**（qnaigc、OpenAI、DeepSeek、Moonshot、Ollama 等），提供接近原生 App 的交互体验。

所有数据（端点 Key、对话、预设）只保存在**本机浏览器**，不经过任何第三方服务器。

## 功能

- ✅ **多端点 / 多模型切换**：一把 Key 一个端点，可配置任意数量；模型按端点分组，顶部下拉随时切换。
- ✅ **多会话并行**：新建/置顶/重命名/删除/归档；会话按最近更新时间排序。
- ✅ **流式输出**：打字机效果，支持思考型模型（reasoning_content）显示「思考中…」。
- ✅ **富文本渲染**：Markdown、GFM 表格、代码高亮（highlight.js）+ 一键复制、LaTeX 公式（KaTeX）。
- ✅ **角色 / 提示词 / 快捷指令**：预置「韩语老师 / 代码审查员 / 健身教练 / 中文润色 / 翻译 / 总结 / 解释错误」，可增删改。
- ✅ **图片输入**：粘贴或选择图片，发送给 Vision 模型（OpenAI 多模态 `image_url` 格式）。
- ✅ **语音输入 / 朗读**：Web Speech API 语音转文字（长按麦克风），可选朗读回复。
- ✅ **搜索历史**：按标题或消息内容搜索会话。
- ✅ **导出 / 分享**：单会话或全部导出为 Markdown。
- ✅ **PWA**：可添加到主屏幕，Service Worker 提供离线缓存；深色/浅色主题。

## 目录结构

```
my-app-ai/
├─ index.html            # 页面结构与依赖引入
├─ manifest.webmanifest  # PWA 清单
├─ sw.js                 # Service Worker
├─ css/styles.css        # 全部样式
├─ js/
│  ├─ storage.js         # localStorage 持久化
│  ├─ utils.js           # 工具函数
│  ├─ markdown.js        # Markdown / 代码高亮 / 公式渲染
│  ├─ chat.js            # OpenAI 兼容流式客户端
│  ├─ voice.js           # 语音识别与朗读
│  └─ app.js             # 应用主逻辑
├─ icons/                # 应用图标（SVG + PNG 192/512）
└─ android/              # 打包 APK 说明
```

## 快速开始

无需任何构建。任选其一：

```bash
# 方式一：直接用 Python 起一个本地静态服务器
python -m http.server 8080
# 浏览器打开 http://localhost:8080
```

```bash
# 方式二：Node
npx serve .
```

> 也可以直接双击 `index.html`（`file://` 协议）。但语音输入、Service Worker、剪贴板读取等能力需要 `http(s)` 环境，推荐用本地服务器。

## 使用步骤

1. 打开 App → 点左下角 **⚙️ 设置** → **＋ 添加端点**。
2. 填写：名称、Base URL（如 `https://api.qnaigc.com/v1`）、API Key、模型列表（可点「从 /models 拉取」自动获取）。
3. 回到主界面，顶部下拉选择模型，开始对话。

## 说明与限制

- **直连 + 跨域**：App 直接向端点发起请求。若目标服务未开启 CORS，浏览器会拦截。国内网络环境建议使用已开放 CORS 的网关（qnaigc 等中转通常已支持）。
- **Key 安全**：Key 以明文存在 `localStorage` 中，仅限个人设备使用。不要在没有可信来源的页面里粘贴 Key。
- **图片**：使用 OpenAI 多模态格式 `{"type":"image_url","image_url":{"url":"data:image/..."}}`。若所用中转不支持此格式，图片会被忽略。
- **语音**：依赖浏览器内置的 `SpeechRecognition`（Chrome/Edge 支持较好）；系统未安装语音包时可能无法识别。

## 打包成 Android APK

见 [android/README.md](android/README.md)。推荐使用 **Bubblewrap（TWA）** 将本 PWA 打包为可安装 APK，或使用 Capacitor 封装。
