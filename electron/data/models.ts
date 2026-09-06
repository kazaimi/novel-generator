import type { ModelPreset } from '@shared/types'

/**
 * 免费模型池 —— OpenRouter 上的免费模型。
 * 单个免费模型日限约 50-200 次，池化轮换以叠加配额支撑一局完整游戏。
 *
 * 注：免费模型列表会随时间变动（:free 后缀可能临时下线），可在设置页调整启用项。
 * 2026-06 实测可用的免费模型。
 */
export const FREE_MODEL_POOL: ModelPreset[] = [
  {
    id: 'qwen/qwen3-next-80b-a3b-instruct:free',
    label: 'Qwen3 Next 80B',
    description: '通义千问 80B，中文叙事优秀',
    supportsJsonSchema: true
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct:free',
    label: 'Llama 3.3 70B',
    description: 'Meta 开源，长文稳定',
    supportsJsonSchema: true
  },
  {
    id: 'openai/gpt-oss-120b:free',
    label: 'GPT-OSS 120B',
    description: 'OpenAI 开源大模型，质量高',
    supportsJsonSchema: true
  },
  {
    id: 'nousresearch/hermes-3-llama-3.1-405b:free',
    label: 'Hermes 3 405B',
    description: 'Nous 出品 405B，创作力强',
    supportsJsonSchema: true
  },
  {
    id: 'google/gemma-4-31b-it:free',
    label: 'Gemma 4 31B',
    description: 'Google 开源，响应稳定',
    supportsJsonSchema: true
  },
  {
    id: 'nvidia/nemotron-3-super-120b-a12b:free',
    label: 'Nemotron 3 Super 120B',
    description: 'NVIDIA 出品，大参数',
    supportsJsonSchema: false
  },
  {
    id: 'openai/gpt-oss-20b:free',
    label: 'GPT-OSS 20B',
    description: '轻量快速，OpenAI 开源',
    supportsJsonSchema: false
  }
]

/** 默认启用的模型（前 4 个） */
export const DEFAULT_ENABLED_MODELS = FREE_MODEL_POOL.slice(0, 4).map((m) => m.id)

/** 按 id 查找预设 */
export function findModelPreset(id: string): ModelPreset | undefined {
  return FREE_MODEL_POOL.find((m) => m.id === id)
}
