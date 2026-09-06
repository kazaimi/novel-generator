import type { ProviderPreset } from '@shared/types'

/**
 * 平台预设 —— 一键切换 API 提供商。
 * 全部兼容 OpenAI SDK，只需更换 baseURL + apiKey + model。
 */
export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'zhipu',
    label: '智谱 GLM',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4/',
    model: 'glm-4-flash',
    needsProxy: false,
    keysUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
    description: 'GLM-4-Flash 永久免费。想更快可将模型改为 glm-4-air（快40%，耗少量额度）。'
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    baseURL: 'https://api.deepseek.com',
    model: 'deepseek-chat',
    needsProxy: false,
    keysUrl: 'https://platform.deepseek.com/api_keys',
    description: '叙事/推理强。新用户送 5000 万 token，价格极低。'
  },
  {
    id: 'siliconflow',
    label: '硅基流动',
    baseURL: 'https://api.siliconflow.cn/v1',
    model: 'Qwen/Qwen2.5-72B-Instruct',
    needsProxy: false,
    keysUrl: 'https://cloud.siliconflow.cn/account/ak',
    description: '聚合多家开源模型。注册送 2000 万 token，可调多个免费模型。'
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    baseURL: 'https://openrouter.ai/api/v1',
    model: 'qwen/qwen3-next-80b-a3b-instruct:free',
    needsProxy: true,
    keysUrl: 'https://openrouter.ai/keys',
    description: '聚合全球模型，免费模型池需代理，高峰期易限速。'
  }
]

/** 按 id 查找预设 */
export function findProvider(id: string): ProviderPreset | undefined {
  return PROVIDER_PRESETS.find((p) => p.id === id)
}
