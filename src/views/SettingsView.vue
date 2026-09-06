<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useConfigStore } from '../stores/config'
import type { ProviderPreset } from '@shared/types'

const configStore = useConfigStore()

const apiKey = ref('')
const baseURL = ref('')
const model = ref('')
const proxyUrl = ref('')
const speed = ref(55)
const sound = ref(true)
const enabledModels = ref<string[]>([])

const testing = ref(false)
const testResult = ref<{ ok: boolean; message: string } | null>(null)
const saved = ref(false)

// 平台预设
const PROVIDERS: ProviderPreset[] = [
  {
    id: 'zhipu',
    label: '智谱 GLM',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4/',
    model: 'glm-4-flash',
    needsProxy: false,
    keysUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
    description: 'GLM-4-Flash 永久免费。想更快可在「模型 ID」填 glm-4-air（快40%，耗少量额度）'
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    baseURL: 'https://api.deepseek.com',
    model: 'deepseek-chat',
    needsProxy: false,
    keysUrl: 'https://platform.deepseek.com/api_keys',
    description: '叙事推理强，新用户送 5000 万 token'
  },
  {
    id: 'siliconflow',
    label: '硅基流动',
    baseURL: 'https://api.siliconflow.cn/v1',
    model: 'Qwen/Qwen2.5-72B-Instruct',
    needsProxy: false,
    keysUrl: 'https://cloud.siliconflow.cn/account/ak',
    description: '聚合开源模型，注册送 2000 万 token'
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    baseURL: 'https://openrouter.ai/api/v1',
    model: 'qwen/qwen3-next-80b-a3b-instruct:free',
    needsProxy: true,
    keysUrl: 'https://openrouter.ai/keys',
    description: '聚合全球模型，需代理，免费模型易限速'
  }
]

// OpenRouter 的免费模型池（仅 OpenRouter 模式下显示）
const OPENROUTER_MODELS = [
  { id: 'qwen/qwen3-next-80b-a3b-instruct:free', label: 'Qwen3 Next 80B' },
  { id: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B' },
  { id: 'openai/gpt-oss-120b:free', label: 'GPT-OSS 120B' },
  { id: 'nvidia/nemotron-3-super-120b-a12b:free', label: 'Nemotron 120B' },
  { id: 'openai/gpt-oss-20b:free', label: 'GPT-OSS 20B' },
  { id: 'google/gemma-4-31b-it:free', label: 'Gemma 4 31B' },
  { id: 'nousresearch/hermes-3-llama-3.1-405b:free', label: 'Hermes 3 405B' }
]

/** 当前选中的平台 */
const currentProvider = computed(
  () => PROVIDERS.find((p) => p.baseURL === baseURL.value) ?? null
)
const isOpenRouter = computed(() => baseURL.value.includes('openrouter.ai'))

onMounted(async () => {
  await configStore.load()
  apiKey.value = configStore.config.apiKey
  baseURL.value = configStore.config.baseURL || PROVIDERS[0].baseURL
  model.value = configStore.config.model || PROVIDERS[0].model
  proxyUrl.value = configStore.config.proxyUrl
  speed.value = configStore.config.typewriterSpeed
  sound.value = configStore.config.soundEnabled
  enabledModels.value = [...configStore.config.enabledModels]
})

/** 选择平台：自动填入 baseURL、model，清空代理（如不需要） */
function selectProvider(p: ProviderPreset): void {
  baseURL.value = p.baseURL
  model.value = p.model
  if (!p.needsProxy) {
    proxyUrl.value = ''
  }
}

function toggleModel(id: string): void {
  const idx = enabledModels.value.indexOf(id)
  if (idx >= 0) {
    if (enabledModels.value.length > 1) enabledModels.value.splice(idx, 1)
  } else {
    enabledModels.value.push(id)
  }
}

async function save(): Promise<void> {
  await configStore.save({
    apiKey: apiKey.value.trim(),
    baseURL: baseURL.value.trim(),
    model: model.value.trim(),
    enabledModels: [...enabledModels.value],
    typewriterSpeed: speed.value,
    soundEnabled: sound.value,
    proxyUrl: proxyUrl.value.trim()
  })
  saved.value = true
  setTimeout(() => (saved.value = false), 1500)
}

async function test(): Promise<void> {
  try {
    await save()
    testing.value = true
    testResult.value = null
    testResult.value = await window.api.testConnection()
  } catch (e) {
    testResult.value = { ok: false, message: (e as Error).message }
  } finally {
    testing.value = false
  }
}
</script>

<template>
  <section class="settings reading-col">
    <h1 class="page-title">设置</h1>

    <!-- 平台选择 -->
    <div class="block">
      <label class="block-label">选择 AI 平台</label>
      <div class="provider-grid">
        <button
          v-for="p in PROVIDERS"
          :key="p.id"
          class="provider-card"
          :class="{ active: baseURL === p.baseURL }"
          @click="selectProvider(p)"
        >
          <div class="provider-label">{{ p.label }}</div>
          <div class="provider-desc">{{ p.description }}</div>
          <div v-if="p.needsProxy" class="provider-tag">需代理</div>
        </button>
      </div>
    </div>

    <!-- API Key -->
    <div class="block">
      <label class="block-label">
        API Key
        <a
          v-if="currentProvider"
          :href="currentProvider.keysUrl"
          class="link"
          target="_blank"
          rel="noreferrer"
        >→ 申请 Key</a>
      </label>
      <input
        v-model="apiKey"
        type="password"
        class="input"
        placeholder="sk-..."
        autocomplete="off"
      />
      <p class="block-hint">Key 仅保存在本机，不会上传。</p>
    </div>

    <!-- 模型 / baseURL（高级） -->
    <div class="block">
      <label class="block-label">模型 ID</label>
      <input v-model="model" type="text" class="input" placeholder="glm-4-flash" autocomplete="off" />
      <details class="advanced">
        <summary>高级：自定义 API 地址</summary>
        <input v-model="baseURL" type="text" class="input" placeholder="https://..." autocomplete="off" />
      </details>
    </div>

    <!-- OpenRouter 模型池（仅 OpenRouter 模式） -->
    <div v-if="isOpenRouter" class="block">
      <label class="block-label">启用的免费模型（勾选并轮换）</label>
      <div class="model-chips">
        <button
          v-for="m in OPENROUTER_MODELS"
          :key="m.id"
          class="model-chip"
          :class="{ active: enabledModels.includes(m.id) }"
          @click="toggleModel(m.id)"
        >
          {{ m.label }}
        </button>
      </div>
      <p class="block-hint">OpenRouter 免费模型高峰期易限速，建议勾选多个轮换。</p>
    </div>

    <!-- 代理（仅需要的平台显示） -->
    <div v-if="isOpenRouter" class="block">
      <label class="block-label">网络代理</label>
      <input
        v-model="proxyUrl"
        type="text"
        class="input"
        placeholder="http://127.0.0.1:7890"
        autocomplete="off"
      />
      <p class="block-hint">OpenRouter 需代理访问。其他平台（智谱/DeepSeek）国内直连无需填。</p>
    </div>

    <!-- 打字机 -->
    <div class="block">
      <label class="block-label">打字机速度：<span class="value">每字 {{ speed }}ms</span></label>
      <input v-model.number="speed" type="range" min="20" max="120" step="5" class="slider" />
    </div>

    <div class="block">
      <label class="row">
        <span class="block-label" style="margin: 0">打字音效</span>
        <input v-model="sound" type="checkbox" class="checkbox" />
      </label>
    </div>

    <div class="block actions-row">
      <button class="btn btn-primary" @click="test" :disabled="testing">
        {{ testing ? '测试中…' : '保存并测试连接' }}
      </button>
      <button class="btn" @click="save">仅保存</button>
      <span v-if="saved" class="saved-tip">已保存 ✓</span>
    </div>

    <div v-if="testResult" class="test-result" :class="{ ok: testResult.ok, fail: !testResult.ok }">
      {{ testResult.ok ? '✓ ' + testResult.message : '✕ ' + testResult.message }}
    </div>
  </section>
</template>

<style scoped>
.settings {
  padding: 48px 24px 80px;
}
.page-title {
  font-size: 26px;
  font-weight: 600;
  margin-bottom: 36px;
  letter-spacing: 0.08em;
}
.block {
  margin-bottom: 32px;
}
.block-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 14px;
  color: var(--fg-soft);
  margin-bottom: 12px;
  letter-spacing: 0.06em;
}
.block-label .value {
  color: var(--accent);
}
.block-hint {
  margin-top: 8px;
  font-size: 12px;
  color: var(--fg-muted);
}
.link {
  color: var(--accent);
  text-decoration: none;
  border-bottom: 1px dashed var(--accent-soft);
  font-size: 12px;
}
.provider-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.provider-card {
  position: relative;
  padding: 14px 16px;
  background: var(--bg-soft);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  text-align: left;
  transition: all 0.2s var(--ease);
}
.provider-card:hover {
  border-color: var(--accent-soft);
}
.provider-card.active {
  border-color: var(--accent);
  background: var(--bg-elevated);
}
.provider-label {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 4px;
}
.provider-desc {
  font-size: 12px;
  color: var(--fg-muted);
  line-height: 1.5;
}
.provider-tag {
  position: absolute;
  top: 10px;
  right: 10px;
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(201, 168, 106, 0.15);
  color: var(--accent);
}
.input {
  width: 100%;
  padding: 12px 14px;
  background: var(--bg-soft);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  font-size: 15px;
  outline: none;
  transition: border 0.2s;
}
.input:focus {
  border-color: var(--accent-soft);
}
.advanced {
  margin-top: 8px;
}
.advanced summary {
  font-size: 12px;
  color: var(--fg-muted);
  cursor: pointer;
  margin-bottom: 6px;
}
.advanced .input {
  margin-top: 6px;
}
.model-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.model-chip {
  padding: 6px 14px;
  font-size: 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--fg-soft);
  transition: all 0.15s;
}
.model-chip.active {
  border-color: var(--accent);
  color: var(--accent);
  background: rgba(201, 168, 106, 0.08);
}
.row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.slider {
  width: 100%;
  accent-color: var(--accent);
}
.checkbox {
  width: 18px;
  height: 18px;
  accent-color: var(--accent);
}
.actions-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.saved-tip {
  color: var(--accent);
  font-size: 13px;
}
.test-result {
  margin-top: 16px;
  padding: 12px 16px;
  border-radius: var(--radius);
  font-size: 14px;
  word-break: break-all;
}
.test-result.ok {
  background: rgba(106, 168, 106, 0.12);
  color: #8fcf8f;
}
.test-result.fail {
  background: rgba(201, 122, 106, 0.12);
  color: var(--danger);
}
</style>
