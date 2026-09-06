import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { AppConfig } from '@shared/types'
import { typewriterSound } from '../audio/typewriter'

/**
 * 应用配置 store。
 * 与主进程的 electron-store 同步。
 */
export const useConfigStore = defineStore('config', () => {
  const config = ref<AppConfig>({
    apiKey: '',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4/',
    model: 'glm-4-flash',
    enabledModels: [],
    typewriterSpeed: 55,
    soundEnabled: true,
    proxyUrl: ''
  })
  const loaded = ref(false)

  async function load(): Promise<void> {
    config.value = await window.api.getConfig()
    typewriterSound.setEnabled(config.value.soundEnabled)
    loaded.value = true
  }

  async function save(patch: Partial<AppConfig>): Promise<void> {
    config.value = { ...config.value, ...patch }
    // IPC 用结构化克隆序列化，Vue 响应式 Proxy 不可克隆，需转纯对象
    const plain = JSON.parse(JSON.stringify(patch)) as Partial<AppConfig>
    await window.api.setConfig(plain)
    if (patch.soundEnabled !== undefined) {
      typewriterSound.setEnabled(patch.soundEnabled)
    }
  }

  return { config, loaded, load, save }
})
