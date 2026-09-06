# 📖 小说生成器（Novel Generator）

> 一个 AI 驱动的互动叙事游戏。你的每一次抉择，都在书写独一无二的故事；故事完结时，整段历程将被编织成一部只属于你的小说。

![License](https://img.shields.io/badge/License-MIT-blue) ![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS-lightgrey) ![Electron](https://img.shields.io/badge/Electron-33-47848F)

## ✨ 特色

1. **心理测试式开场** —— 不让你"选题材/填表"。AI 用几道看似无关的小问题（雨夜敲门、不会失去的东西…）暗中推断你的倾向，反向定制题材、世界观、主角与开局。
2. **Director 剧情管理员** —— 全程把控剧情：启承转合的章节骨架、张弛有度的情绪曲线、严格的类型守卫、前后连贯的一致性约束、适量的正文长度。AI 不会"跑飞"。
3. **长程记忆** —— 退出后下次可无缝续上。三层状态（完整历程 + LLM 压缩摘要 + 世界状态），故事再长也不丢上下文。
4. **玩家画像全程演进** —— AI 每轮观察你的选择并累积"行为倾向"，叙事与选项设计随游玩越来越贴合你。
5. **完结生成完整小说** —— 故事落幕时，AI 把你的整段游玩历程"小说化"：统一视角、补全过渡、去除选项痕迹，生成一部带序言、章节、尾声的完整作品，可导出 TXT / Markdown。
6. **流式实时上屏** —— 正文边生成边逐字浮现（增量 JSON 解析），配合 Web Audio 合成的打字音效，等待即体验。
7. **极简设计感** —— 霞鹜文楷字体、墨黑米白配色、考究排版、前情回顾抽屉。

## 🎮 给玩家：安装与配置

1. 下载 `novel-generator-0.1.0-setup.exe` 双击安装（如遇 Windows 蓝色警告：**「更多信息」→「仍要运行」**）
2. 获取免费 Key：打开 [open.bigmodel.cn/usercenter/apikeys](https://open.bigmodel.cn/usercenter/apikeys) → 注册 → 创建 API Key → 复制
3. 游戏内「设置」→ 粘贴 Key → **「保存并测试连接」** → 看到 ✓ 即可开玩

> 📘 详细图文步骤、常见问题排查见 **[游玩说明.md](./游玩说明.md)**

## 🤖 AI 方案

- **多平台可切换**：智谱 GLM（默认，GLM-4-Flash 永久免费）/ DeepSeek / 硅基流动 / OpenRouter，一套 OpenAI 兼容接口通吃，设置页一键切换
- 内置**限速容错**：429/5xx 自动切换模型 + 指数退避重试；取消生成真正断流（AbortController），不浪费配额
- **结构化输出三层降级**：json_schema → json_object → 追加修复重试；输出 JSON 的 `answer` 包裹自动解包，纯文本自动转结构化
- **长局防护**：滚动摘要（LLM 压缩）+ 成书分批渲染，玩上百轮也不会撑爆上下文
- Director 每轮指令**纯规则计算、不调 LLM**，一局 N 轮仅需 N 次调用，对免费配额极其友好

## 🏗️ 架构

```
Renderer (Vue 3)                    Main (Node)
┌──────────────────┐                ┌──────────────────────┐
│ IntroView 心理测试│  IPC 安全桥    │ Profiler 画像推断     │
│ StoryView 故事   │ ←──────────→   │ Director 导演(规则)   │
│ NovelView 成书   │                │ Memory 状态+摘要压缩  │
│ Archive/Settings │                │ AIClient 多平台+容错  │
│ Pinia stores     │                │ NovelGenerator 成书   │
│ Typewriter+音效  │                │ Storage 存档          │
└──────────────────┘                └──────────────────────┘
```

**每轮数据流**：玩家选择 → Director 规则推导指令（0 LLM）→ PromptBuilder 组装 → Writer LLM 流式生成 → 增量提取 narrative 实时上屏 → JSON 解析 → Memory 推进状态并持久化。

## 🧪 端到端测试

`e2e/` 目录含完整游戏循环回归测试：用桩替换 Electron 环境后直接驱动真实主进程逻辑，
覆盖 开场 → 蓝图 → 多轮剧情 → 章节推进 → 成书。运行方式见 [e2e/README.md](./e2e/README.md)。

## 🛠️ 开发

```bash
npm install        # 安装依赖
npm run dev        # 开发模式（主进程 HMR + 渲染层 HMR）
npm run typecheck  # 双端类型检查
npm run build:win  # 打包 Windows 安装程序（建议配置 npmmirror 镜像）
```

技术栈：Electron 33 · electron-vite · Vue 3 · TypeScript · Pinia · OpenAI SDK（兼容多平台）· electron-store · 霞鹜文楷

## 📄 License

[MIT](./LICENSE) © 2026 kazaimi
