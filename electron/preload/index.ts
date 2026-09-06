import { contextBridge, ipcRenderer } from 'electron'
import type { ApiExpose, AppConfig, GeneratedNovel, GenerateResult, StreamEvent, StorySave } from '@shared/types'

/**
 * preload 桥：用 contextBridge 暴露受限的 API 给渲染进程。
 * 渲染进程通过 window.api.* 调用，API Key 等敏感信息始终留在主进程。
 */

/**
 * 把任意值转为「可被 IPC 结构化克隆」的纯对象。
 * Vue/Pinia 的响应式 Proxy 无法跨 IPC 传输，必须先解包。
 */
function toPlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

const api: ApiExpose = {
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (patch: Partial<AppConfig>) => ipcRenderer.invoke('config:set', toPlain(patch)),
  testConnection: () => ipcRenderer.invoke('ai:testConnection'),

  getIntroQuestions: () => ipcRenderer.invoke('intro:questions'),
  startIntro: (answers) => ipcRenderer.invoke('intro:start', toPlain(answers)),

  listSaves: () => ipcRenderer.invoke('save:list'),
  loadSave: (id: string) => ipcRenderer.invoke('save:load', id),
  saveStory: (save: StorySave) => ipcRenderer.invoke('save:put', toPlain(save)),
  deleteSave: (id: string) => ipcRenderer.invoke('save:delete', id),

  generateNext: (save, chosenId, listener) => {
    // 监听主进程推送的流事件
    const onEvent = (_e: unknown, event: StreamEvent) => listener(event)
    ipcRenderer.on('generate:event', onEvent)

    return ipcRenderer
      .invoke('generate:next', toPlain(save), chosenId)
      .finally(() => {
        ipcRenderer.removeListener('generate:event', onEvent)
      }) as Promise<GenerateResult | null>
  },
  cancelGenerate: () => ipcRenderer.invoke('generate:cancel'),

  generateNovel: (save) => ipcRenderer.invoke('novel:generate', toPlain(save)),
  exportNovel: (novel: GeneratedNovel, format) =>
    ipcRenderer.invoke('novel:export', toPlain(novel), format)
}

// 用 any 断言：contextBridge 的类型签名与我们的 ApiExpose 不完全吻合
contextBridge.exposeInMainWorld('api', api)
