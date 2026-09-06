/**
 * shared/types.ts
 * 主进程与渲染进程共享的类型定义 —— 整个项目的数据契约。
 */

/* ============ AI / 模型相关 ============ */

/** 单个免费模型预设 */
export interface ModelPreset {
  /** OpenRouter 模型 ID，如 "deepseek/deepseek-chat-v3-0324:free" */
  id: string
  /** 展示名 */
  label: string
  /** 简介 */
  description: string
  /** 是否支持 response_format: json_schema */
  supportsJsonSchema: boolean
}

/** 应用配置（持久化到 electron-store） */
export interface AppConfig {
  /** API Key（智谱/DeepSeek/OpenRouter 等） */
  apiKey: string
  /** API base URL，如智谱 https://open.bigmodel.cn/api/paas/v4/ */
  baseURL: string
  /** 模型 id，如 glm-4-flash */
  model: string
  /** 启用的模型 ID 列表（顺序即轮换优先级，OpenRouter 模式下使用） */
  enabledModels: string[]
  /** 打字机速度：每字毫秒数 */
  typewriterSpeed: number
  /** 是否开启打字音效 */
  soundEnabled: boolean
  /** HTTP(S) 代理地址，如 http://127.0.0.1:56666；为空则直连 */
  proxyUrl: string
}

/** 平台预设 */
export interface ProviderPreset {
  id: string
  label: string
  baseURL: string
  /** 默认模型 */
  model: string
  /** 是否需要代理 */
  needsProxy: boolean
  /** 申请 Key 的地址 */
  keysUrl: string
  /** 说明 */
  description: string
}

/** AI 一轮生成的结构化输出 */
export interface StoryTurn {
  /** 本段正文（受导演指令约束，约 180-220 字） */
  narrative: string
  /** 3 个选项 */
  choices: StoryChoice[]
  /** 世界状态增量 */
  stateDelta: WorldStateDelta
  /** 玩家画像增量 */
  profileDelta: ProfileDelta
  /** 章节进度反馈 */
  chapterProgress: {
    goalMet: boolean
    advanceChapter: boolean
  }
  /** 是否为结局 */
  isEnding: boolean
}

export interface StoryChoice {
  id: string
  text: string
  tags?: string[]
}

export interface WorldStateDelta {
  inventory?: string[]
  flags?: Record<string, boolean | string | number>
  npcs?: Record<string, string>
}

export interface ProfileDelta {
  /** 键值形式：{ morality: "+1善", temperament: "好奇" } */
  [key: string]: string
}

/* ============ 玩家画像（开场测试得出） ============ */

/** 开场心理测试题 */
export interface IntroQuestion {
  id: string
  prompt: string
  options: { text: string }[]
}

export interface PlayerProfile {
  /** 冒险 vs 安稳，-5(极安稳) ~ +5(极冒险) */
  riskTolerance: number
  /** 明亮 vs 黑暗倾向，-5(暗黑) ~ +5(明亮) */
  tone: number
  /** 节奏偏好，-5(慢热细腻) ~ +5(快节奏刺激) */
  pace: number
  /** 重情 vs 重理，-5(重理) ~ +5(重情) */
  heart: number
  /** 推断出的题材偏好 */
  genrePreference: string
  /** 自由描述（一句话画像） */
  summary: string
  /** 游玩过程中 AI 观察到的行为倾向积累（profileDelta 累积，供叙事逐步贴合玩家） */
  evolvingNotes: string[]
}

/* ============ Director 章节蓝图 ============ */

export interface StoryOutline {
  /** 锁定的题材类型 */
  genre: string
  /** 核心设定 / 前提 */
  premise: string
  /** 世界观设定 */
  worldSetting: string
  /** 章节列表 */
  chapters: OutlineChapter[]
}

export interface OutlineChapter {
  index: number
  title: string
  /** 启承转合 */
  act: '起' | '承' | '转' | '合'
  /** 情绪紧张度 1-5 */
  tension: number
  /** 本章核心目标 */
  goal: string
  /** 预计轮数 */
  estTurns: number
}

/* ============ 世界状态 ============ */

export interface WorldState {
  inventory: string[]
  flags: Record<string, boolean | string | number>
  npcs: Record<string, string>
  /** 当前章节索引（1-based） */
  currentChapter: number
  /** 当前章节已进行轮数 */
  chapterTurnCount: number
}

/* ============ 完整存档对象（一个游戏） ============ */

export interface StorySave {
  /** 存档 ID */
  id: string
  /** 显示名（自动取自第一章标题或题材） */
  title: string
  /** 创建时间 ISO */
  createdAt: string
  /** 最后游玩时间 ISO */
  updatedAt: string
  /** 玩家画像 */
  playerProfile: PlayerProfile
  /** 章节蓝图 */
  storyOutline: StoryOutline
  /** 世界状态 */
  worldState: WorldState
  /** 旧章节压缩摘要 */
  summary: string
  /** 完整历程（永久保留，供生成小说） */
  rawHistory: RawTurn[]
  /** 最近 N 轮原文 */
  recentTurns: RawTurn[]
  /** 是否已完结 */
  finished: boolean
  /** 完结后生成的小说（可空） */
  novel?: GeneratedNovel
}

/** 历程中的一轮原始记录 */
export interface RawTurn {
  /** 本段正文 */
  narrative: string
  /** 当时呈现的选项 */
  choices: StoryChoice[]
  /** 玩家实际选择（开场第一轮为 null） */
  chosenId: string | null
  /** 时间戳 */
  ts: string
}

/* ============ 完结小说 ============ */

export interface GeneratedNovel {
  title: string
  author: string
  chapters: { heading: string; content: string }[]
  preface: string
  epilogue: string
  generatedAt: string
}

/** 生成结果：本轮剧情 + 主进程推进后的存档 */
export interface GenerateResult {
  turn: StoryTurn
  save: StorySave
}

/* ============ 流式生成事件 ============ */

/** 流式 token 事件 */
export interface StreamToken {
  type: 'token'
  /** 增量文本 */
  delta: string
}

/** 流结束事件（携带最终解析结果） */
export interface StreamDone {
  type: 'done'
  turn: StoryTurn | null
  error?: string
}

/** 状态事件（正在切换模型等） */
export interface StreamStatus {
  type: 'status'
  message: string
}

/** narrative 增量事件：携带从残缺 JSON 中实时提取出的正文（累计全文） */
export interface StreamNarrative {
  type: 'narrative'
  /** narrative 当前已生成的完整文本 */
  text: string
}

export type StreamEvent = StreamToken | StreamDone | StreamStatus | StreamNarrative

/* ============ IPC 接口契约 ============ */

export interface ApiExpose {
  /** 读取应用配置 */
  getConfig: () => Promise<AppConfig>
  /** 保存应用配置 */
  setConfig: (patch: Partial<AppConfig>) => Promise<void>
  /** 测试模型连接，返回 ok/错误信息 */
  testConnection: () => Promise<{ ok: boolean; message: string }>
  /** 获取开场心理测试题库 */
  getIntroQuestions: () => Promise<IntroQuestion[]>
  /** 开场：画像→蓝图→创建存档，返回初始存档 */
  startIntro: (answers: Record<string, number>) => Promise<StorySave>
  /** 读取所有存档摘要 */
  listSaves: () => Promise<StorySave[]>
  /** 读取单个存档 */
  loadSave: (id: string) => Promise<StorySave | null>
  /** 保存（创建或覆盖） */
  saveStory: (save: StorySave) => Promise<void>
  /** 删除存档 */
  deleteSave: (id: string) => Promise<void>
  /**
   * 生成下一轮剧情（流式）。
   * 事件通过 listener 回调推送；完成后返回本轮结果与主进程已推进状态并持久化的存档。
   */
  generateNext: (
    save: StorySave,
    chosenId: string | null,
    listener: (event: StreamEvent) => void
  ) => Promise<GenerateResult | null>
  /** 取消进行中的生成 */
  cancelGenerate: () => Promise<void>
  /** 完结时生成完整小说 */
  generateNovel: (save: StorySave) => Promise<{ ok: true; novel: GeneratedNovel } | { ok: false; error: string }>
  /** 导出小说为文件 */
  exportNovel: (novel: GeneratedNovel, format: 'txt' | 'markdown') => Promise<{ ok: boolean; path?: string; error?: string }>
}

/** 通过 window.api 暴露给渲染进程 */
declare global {
  interface Window {
    api: ApiExpose
  }
}
