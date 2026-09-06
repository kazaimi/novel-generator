import OpenAI from 'openai'
import { ProxyAgent, fetch as undiciFetch, type Dispatcher } from 'undici'
import type { AppConfig } from '@shared/types'
import { getConfig } from '../store/config'
import { findModelPreset } from '../data/models'

/** 智谱 GLM 的 OpenAI 兼容端点（默认） */
const DEFAULT_BASE_URL = 'https://open.bigmodel.cn/api/paas/v4/'
const DEFAULT_MODEL = 'glm-4-flash'

/** 带状态码与可重试标记的错误 */
export class AIError extends Error {
  retryable: boolean
  status?: number
  constructor(message: string, opts: { retryable?: boolean; status?: number } = {}) {
    super(message)
    this.retryable = opts.retryable ?? true
    this.status = opts.status
  }
}

/** 是否应原地退避重试（同一模型）：限速、服务器错误、网络错误 */
function shouldBackoffRetry(status: number | undefined): boolean {
  if (status === undefined) return true // 网络错误
  return status === 429 || status >= 500
}

/** 是否应切换到下一个模型：402(余额/额度)、429(限速)、5xx、网络错误 */
function shouldSwitchModel(status: number | undefined): boolean {
  if (status === undefined) return true
  // 402 可能只是某个提供商的免费额度问题，换模型或许可用
  // 401/403 是鉴权问题（Key 错），不切换
  // 400 是请求格式问题，不切换
  return status === 402 || status === 429 || status >= 500
}

/** 指数退避 sleep */
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface GenerateOptions {
  /** 最多尝试的模型数量 */
  maxModelSwitches?: number
  /** 单模型重试次数 */
  retriesPerModel?: number
  /** 是否流式 */
  stream?: boolean
  /** JSON schema（模型支持时用于结构化输出） */
  jsonSchema?: Record<string, unknown>
  /** 期望 JSON 输出（无需 schema 时） */
  jsonObject?: boolean
  /** 温度 */
  temperature?: number
  /** 单 token 回调（流式） */
  onToken?: (delta: string) => void
  /** 状态回调（切换模型等） */
  onStatus?: (message: string) => void
  /** 取消信号 */
  shouldCancel?: () => boolean
  /** 中断信号：abort 时真正断开 HTTP 流（省配额） */
  signal?: AbortSignal
}

/**
 * OpenRouter 免费模型池客户端。
 *
 * 工作方式：按启用模型顺序依次尝试，遇限速/错误则切换下一个模型，
 * 并在单模型上做指数退避重试。
 */
export class AIClient {
  private client: OpenAI
  private models: string[]
  private proxyUrl: string

  constructor(config?: AppConfig) {
    const cfg = config ?? getConfig()
    if (!cfg.apiKey) {
      throw new AIError('未配置 API Key，请先在设置中填写', { retryable: false })
    }

    // 解析代理地址：配置项优先，其次环境变量（国内平台一般不需要）
    this.proxyUrl = cfg.proxyUrl || process.env.HTTPS_PROXY || process.env.HTTP_PROXY || ''

    const baseURL = cfg.baseURL || DEFAULT_BASE_URL
    // 是否为 OpenRouter（需要专用请求头 + 模型池轮换）
    const isOpenRouter = baseURL.includes('openrouter.ai')

    const clientOpts: ConstructorParameters<typeof OpenAI>[0] = {
      apiKey: cfg.apiKey,
      baseURL,
      // 适当放宽超时
      timeout: 60000,
      maxRetries: 0 // 我们自己实现重试/轮换
    }
    // OpenRouter 需要专用请求头；其他平台不需要
    if (isOpenRouter) {
      clientOpts.defaultHeaders = {
        'HTTP-Referer': 'https://novel-generator.app',
        'X-Title': 'Novel Generator'
      }
    }

    if (this.proxyUrl) {
      // openai SDK v4 用 undici fetch，必须通过自定义 fetch + ProxyAgent 让代理生效。
      const dispatcher: Dispatcher = new ProxyAgent(this.proxyUrl)
      clientOpts.fetch = (url: string | URL | Request, init?: RequestInit) =>
        undiciFetch(url as string, {
          ...(init as Record<string, unknown>),
          dispatcher
        }) as unknown as Promise<Response>
    }
    this.client = new OpenAI(clientOpts)

    if (isOpenRouter) {
      // OpenRouter：用模型池轮换（免费模型常限速）
      this.models = cfg.enabledModels.length
        ? cfg.enabledModels
        : ['qwen/qwen3-next-80b-a3b-instruct:free']
    } else {
      // 其他平台（智谱/DeepSeek 等）：单一模型即可
      this.models = [cfg.model || DEFAULT_MODEL]
    }
  }

  /** 返回启用的免费模型列表（供测试连接用，不含付费兜底） */
  getEnabledModels(): string[] {
    const cfg = getConfig()
    return cfg.enabledModels.length
      ? [...cfg.enabledModels]
      : ['qwen/qwen3-next-80b-a3b-instruct:free']
  }

  /**
   * 生成一次补全。按模型池顺序尝试，遇可重试错误切换模型。
   * 返回完整文本（流式时通过 onToken 推送增量）。
   */
  async generate(messages: ChatMessage[], options: GenerateOptions = {}): Promise<string> {
    const {
      maxModelSwitches = this.models.length,
      retriesPerModel = 2,
      stream = true,
      jsonSchema,
      jsonObject,
      temperature = 0.85,
      onToken,
      onStatus,
      shouldCancel,
      signal
    } = options

    let lastError: AIError | null = null

    for (let attempt = 0; attempt < maxModelSwitches; attempt++) {
      const model = this.models[attempt]
      const preset = findModelPreset(model)

      // 决定 response_format：优先 schema，其次 json_object
      let response_format: Record<string, unknown> | undefined
      if (jsonSchema && preset?.supportsJsonSchema) {
        response_format = {
          type: 'json_schema',
          json_schema: { name: 'result', schema: jsonSchema, strict: false }
        }
      } else if (jsonObject) {
        response_format = { type: 'json_object' }
      }

      // 单模型重试（指数退避）
      for (let r = 0; r <= retriesPerModel; r++) {
        if (shouldCancel?.()) throw new AIError('已取消', { retryable: false })

        const label = preset?.label ?? model.replace(/.*\//, '')
        if (attempt > 0 || r > 0) {
          onStatus?.(`正在重试（${label}）`)
        } else {
          onStatus?.(`生成中（${label}）`)
        }

        try {
          const params: Record<string, unknown> = {
            model,
            messages,
            temperature,
            stream: stream ? true : false
          }
          if (response_format) {
            // OpenRouter 接受 response_format 字段
            params.response_format = response_format
          }

          // 使用 unknown 中转，规避 OpenAI SDK 联合类型的类型冲突
          // 第二参数传 signal：abort 时真正断开 HTTP 流
          const completion = await this.client.chat.completions.create(
            params as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming,
            signal ? { signal } : undefined
          )

          let full = ''
          if (stream) {
            const stream_ = completion as unknown as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>
            for await (const chunk of stream_) {
              if (shouldCancel?.()) throw new AIError('已取消', { retryable: false })
              const delta = chunk.choices?.[0]?.delta?.content ?? ''
              if (delta) {
                full += delta
                onToken?.(delta)
              }
            }
          } else {
            const res = completion as unknown as OpenAI.Chat.Completions.ChatCompletion
            full = res.choices?.[0]?.message?.content ?? ''
            onToken?.(full)
          }
          return full
        } catch (err) {
          // 输出完整错误到主进程日志，便于排查网络/代理问题
          const e = err as Error & { status?: number; code?: string; cause?: unknown }
          console.error('[AIClient] 请求失败:', {
            model,
            message: e.message,
            code: e.code,
            status: e.status,
            cause: e.cause instanceof Error ? e.cause.message : String(e.cause),
            proxy: this.proxyUrl || '(无代理)'
          })
          const status = e.status
          lastError = new AIError(
            e.message || '生成失败',
            { retryable: shouldSwitchModel(status), status }
          )

          if (!shouldSwitchModel(status)) {
            // 鉴权/格式错误（401/403/400），换模型也没用，直接抛出
            throw lastError
          }
          // 可切换模型：先尝试原地退避重试（仅对 429/5xx/网络），
          // 402 不原地等（等也没用），直接耗尽本模型重试后切下一个
          if (shouldBackoffRetry(status)) {
            // 429 免费模型配额恢复较慢，退避 15/30/45 秒
            const backoff = status === 429 ? 15000 * (r + 1) : 500 * Math.pow(2, r)
            await sleep(backoff)
          }
        }
      }
      // 当前模型重试耗尽，切换下一个
      onStatus?.(`模型 ${preset?.label ?? model} 繁忙，切换中…`)
    }

    throw lastError ?? new AIError('所有模型均失败')
  }
}
