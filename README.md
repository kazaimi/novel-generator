# 📖 小说生成器（Novel Generator）

> 一个 AI 驱动的互动叙事游戏。你的每一次抉择，都在书写独一无二的故事；故事完结时，整段历程将被编织成一部只属于你的小说。

## ✨ 特色

1. **心理测试式开场** —— 不让你"选题材/填表"。AI 用几道看似无关的小问题（雨夜敲门、不会失去的东西…）暗中推断你的倾向，反向定制题材、世界观、主角与开局。
2. **Director 剧情管理员** —— 全程把控剧情：启承转合的章节骨架、张弛有度的情绪曲线、严格的类型守卫、前后连贯的一致性约束、适量的正文长度。AI 不会"跑飞"。
3. **长程记忆** —— 退出后下次可无缝续上。三层状态（完整历程 + 滚动摘要 + 世界状态），故事再长也不丢上下文。
4. **完结生成完整小说** —— 故事落幕时，AI 把你的整段游玩历程"小说化"：统一视角、补全过渡、去除选项痕迹，生成一部带序言、章节、尾声的完整作品，可导出。
5. **极简设计感** —— 霞鹜文楷字体、墨黑米白配色、考究排版、逐字打字机效果、Web Audio 合成的清脆打字音效。

## 🤖 AI 方案

- 使用 **OpenRouter 免费模型池**（DeepSeek / Qwen / Llama / Gemini / Mistral 等），多模型轮换叠加免费配额，支撑一整局游戏。
- 内置**限速容错**：遇 429/5xx 自动切换模型 + 指数退避重试。
- **结构化输出三层降级**：json_schema → json_object → 正则修复解析。
- Director 每轮指令**纯规则计算、不调 LLM**，一局 N 轮仅需 N 次调用，对免费配额极其友好。

## 🚀 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 获取 OpenRouter API Key
访问 [openrouter.ai/keys](https://openrouter.ai/keys) 免费注册获取 Key。

### 3. 启动开发模式
```bash
npm run dev
```
首次启动后，进入「设置」填入 API Key、勾选启用的模型、点击"保存并测试连接"。

### 4. 打包发布
```bash
npm run build:win   # Windows
npm run build:mac   # macOS
```

## 🎮 玩法流程

```
开始 → 心理测试（6题）→ AI 生成专属世界与章节蓝图
     → 阅读正文 → 做选择 → AI 推进剧情（循环，Director 把控节奏）
     → 故事完结 → AI 将整段历程落笔成书 → 预览 → 导出 TXT/Markdown
```
退出后可从「书架」继续任意未完结的故事。

## 🏗️ 架构

```
Renderer (Vue 3)                    Main (Node)
┌──────────────────┐                ┌──────────────────────┐
│ IntroView 心理测试│  IPC 安全桥    │ Profiler 画像推断     │
│ StoryView 故事   │ ←──────────→   │ Director 导演(规则)   │
│ NovelView 小说   │                │ AIClient 模型池+容错  │
│ Archive/Settings │                │ Memory 三层记忆       │
│ Pinia stores     │                │ NovelGenerator 成书   │
│ Typewriter+音效  │                │ Storage 存档          │
└──────────────────┘                └──────────────────────┘
```

**核心数据流（每轮生成）：**
```
玩家选择
  → Director 推导导演指令（纯规则，0 LLM 调用）
    → PromptBuilder 组装（题材约束+指令+一致性锚点+摘要+画像）
      → Writer LLM 生成 JSON（流式打字机显示）
        → 三层降级解析 → 应用状态 → 存档
```

## 📁 目录结构

```
electron/
├── ai/            # client(模型池+容错) parser(JSON降级) promptBuilder
├── engine/        # director profiler outlineGenerator novelGenerator
├── data/          # introQuestions(题库) models(模型池)
├── store/         # config(electron-store)
└── main/          # index ipc/handlers preload
src/               # Vue 渲染层（views/stores/components/audio）
shared/types.ts    # 进程共享类型契约
```

## 🛠️ 技术栈

- **Electron + electron-vite + Vue 3 + TypeScript + Pinia**
- **OpenAI SDK**（兼容 OpenRouter）
- **electron-store**（本地存档）
- **霞鹜文楷 LXGW WenKai**（打包字体）
- **Web Audio API**（合成打字音效）

## ⚠️ 说明

- 免费模型有每日配额限制（约 50-200 次/模型/天），已通过多模型轮换缓解；若遇全局饱和，稍后重试即可。
- API Key 仅保存在本机，不会上传。
