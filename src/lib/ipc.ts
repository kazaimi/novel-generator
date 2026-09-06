/**
 * 渲染进程 IPC 调用封装。
 *
 * 关键：contextBridge 传参时会做一次结构化克隆，
 * Vue/Pinia 的响应式 Proxy 在这一步就抛 "An object could not be cloned"。
 * 所以必须在渲染进程侧把所有参数先转成纯对象，不能依赖 preload 里的 toPlain。
 */
import type {
  AppConfig,
  GeneratedNovel,
  GenerateResult,
  StorySave,
  StreamEvent,
  IntroQuestion
} from '@shared/types'

/** 把任意值转成可跨 IPC 克隆的纯对象 */
function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export const ipc = {
  getConfig: (): Promise<AppConfig> => window.api.getConfig(),
  setConfig: (patch: Partial<AppConfig>): Promise<void> => window.api.setConfig(plain(patch)),
  testConnection: (): Promise<{ ok: boolean; message: string }> => window.api.testConnection(),

  getIntroQuestions: (): Promise<IntroQuestion[]> => window.api.getIntroQuestions(),
  startIntro: (answers: Record<string, number>): Promise<StorySave> =>
    window.api.startIntro(plain(answers)),

  listSaves: (): Promise<StorySave[]> => window.api.listSaves(),
  loadSave: (id: string): Promise<StorySave | null> => window.api.loadSave(id),
  saveStory: (save: StorySave): Promise<void> => window.api.saveStory(plain(save)),
  deleteSave: (id: string): Promise<void> => window.api.deleteSave(id),

  generateNext: (
    save: StorySave,
    chosenId: string | null,
    listener: (event: StreamEvent) => void
  ): Promise<GenerateResult | null> => window.api.generateNext(plain(save), chosenId, listener),
  cancelGenerate: (): Promise<void> => window.api.cancelGenerate(),
  generateNovel: (
    save: StorySave
  ): Promise<{ ok: true; novel: GeneratedNovel } | { ok: false; error: string }> =>
    window.api.generateNovel(plain(save)),
  exportNovel: (
    novel: GeneratedNovel,
    format: 'txt' | 'markdown'
  ): Promise<{ ok: boolean; path?: string; error?: string }> =>
    window.api.exportNovel(plain(novel), format)
}
