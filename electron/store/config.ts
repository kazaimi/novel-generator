import Store from 'electron-store'
import type { AppConfig, StorySave } from '@shared/types'
import { DEFAULT_ENABLED_MODELS } from '../data/models'

/**
 * 应用配置的默认值。
 */
export const DEFAULT_CONFIG: AppConfig = {
  apiKey: '',
  baseURL: 'https://open.bigmodel.cn/api/paas/v4/',
  model: 'glm-4-flash',
  enabledModels: [...DEFAULT_ENABLED_MODELS],
  typewriterSpeed: 55, // 每字 55ms，舒适阅读
  soundEnabled: true,
  proxyUrl: ''
}

/** 配置 store */
const configStore = new Store<AppConfig>({
  name: 'config',
  defaults: DEFAULT_CONFIG
})

export function getConfig(): AppConfig {
  return (configStore.store as unknown as AppConfig) || DEFAULT_CONFIG
}

export function setConfig(patch: Partial<AppConfig>): AppConfig {
  configStore.store = { ...getConfig(), ...patch }
  return getConfig()
}

/* ============ 存档 store ============ */

interface SavesSchema {
  saves: StorySave[]
}

const savesStore = new Store<SavesSchema>({
  name: 'saves',
  defaults: { saves: [] }
})

export function listSaves(): StorySave[] {
  return savesStore.get('saves') || []
}

export function loadSave(id: string): StorySave | null {
  return listSaves().find((s) => s.id === id) ?? null
}

export function putSave(save: StorySave): void {
  const saves = listSaves()
  const idx = saves.findIndex((s) => s.id === save.id)
  save.updatedAt = new Date().toISOString()
  if (idx >= 0) {
    saves[idx] = save
  } else {
    saves.push(save)
  }
  savesStore.set('saves', saves)
}

export function deleteSave(id: string): void {
  const saves = listSaves().filter((s) => s.id !== id)
  savesStore.set('saves', saves)
}
