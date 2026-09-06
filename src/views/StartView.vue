<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useConfigStore } from '../stores/config'
import { useStoryStore } from '../stores/story'
import TypewriterText from '../components/TypewriterText.vue'

const configStore = useConfigStore()
const storyStore = useStoryStore()
const emit = defineEmits<{ start: []; continue: [] }>()

const hasApiKey = ref(false)
const hasOngoingSave = ref(false)

onMounted(async () => {
  await configStore.load()
  hasApiKey.value = !!configStore.config.apiKey
  // 检查是否有未完结存档
  try {
    const saves = await window.api.listSaves()
    hasOngoingSave.value = saves.some((s) => !s.finished)
  } catch {
    // 忽略
  }
})

const heroText = '每一个选择，都在书写独一无二的故事。'
</script>

<template>
  <section class="start reading-col">
    <div class="hero">
      <TypewriterText :text="heroText" :speed="80" class="hero-text" />
    </div>

    <p class="tagline">
      这不是阅读，这是共创。<br />
      AI 将依据你的每一次抉择，编织出只属于你的篇章。
    </p>

    <div class="actions">
      <button class="btn btn-primary big" @click="emit('start')" :disabled="!hasApiKey">
        开启新篇章
      </button>
      <button v-if="hasOngoingSave" class="btn big" @click="emit('continue')">
        继续未完的故事
      </button>
    </div>

    <p v-if="!hasApiKey" class="hint">
      ↑ 开始前，请先到「设置」选择 AI 平台并填写 API Key
    </p>
    <p v-else class="hint ready">准备就绪，静候你的第一个抉择。</p>
  </section>
</template>

<style scoped>
.start {
  padding: 80px 24px 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.hero {
  margin-bottom: 28px;
}
.hero-text {
  font-size: 28px;
  line-height: 1.6;
  letter-spacing: 0.06em;
  color: var(--fg);
}
.tagline {
  color: var(--fg-soft);
  font-size: 16px;
  line-height: 2.2;
  margin-bottom: 48px;
}
.actions {
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;
}
.big {
  padding: 14px 40px;
  font-size: 16px;
}
.hint {
  margin-top: 36px;
  color: var(--fg-muted);
  font-size: 13px;
}
.hint.ready {
  color: var(--accent-soft);
}
</style>
