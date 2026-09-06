<script setup lang="ts">
import { ref, computed, nextTick, onMounted } from 'vue'
import { useStoryStore } from '../stores/story'
import { useConfigStore } from '../stores/config'
import TypewriterText from '../components/TypewriterText.vue'

const story = useStoryStore()
const config = useConfigStore()
const emit = defineEmits<{ novel: [] }>()

const scrollRef = ref<HTMLElement | null>(null)
const chosenId = ref<string | null>(null)
const pendingChoice = ref<string | null>(null)

/** 当前应显示的正文：生成中不显示（JSON 流式无法边收边提取正文），
 *  完成后显示解析出的纯正文，由打字机逐字呈现 */
const narrative = computed(() => {
  if (story.generating) return ''
  return story.lastTurn?.narrative ?? ''
})

const choices = computed(() => story.lastTurn?.choices ?? [])

const chapterTitle = computed(() => {
  const outline = story.current?.storyOutline
  const ch = outline?.chapters.find((c) => c.index === story.current?.worldState.currentChapter)
  return ch ? `第 ${ch.index} 章 · ${ch.title}` : ''
})

async function choose(id: string): Promise<void> {
  if (story.generating) return
  chosenId.value = id
  await story.generateNext(id)
  await story.persist()
  chosenId.value = null
}

async function continueStory(): Promise<void> {
  // 续作进入时，若已有内容则继续生成下一轮
  await story.generateNext(null)
  await story.persist()
}

async function scrollDown(): Promise<void> {
  await nextTick()
  if (scrollRef.value) {
    scrollRef.value.scrollTop = scrollRef.value.scrollHeight
  }
}

onMounted(() => {
  // 若存档无内容（刚新建），自动生成第一段
  if (story.current && story.lastTurn === null && story.current.rawHistory.length === 0) {
    void continueStory()
  }
})

const isFinished = computed(() => story.current?.finished)
const noSave = computed(() => !story.current)
</script>

<template>
  <section v-if="noSave" class="story-empty reading-col">
    <p>还没有正在阅读的故事。</p>
    <p class="muted">请到「书架」选择，或「开始」新篇章。</p>
  </section>

  <section v-else ref="scrollRef" class="story reading-col">
    <div class="chapter-marker">{{ chapterTitle }}</div>

    <!-- 生成中：显示进度条（不显示正文，因为流式返回的是 JSON 无法边收边显示） -->
    <div v-if="story.generating" class="inline-loading">
      <div class="inline-bar">
        <div class="inline-bar-fill" :class="{ indeterminate: true }" />
      </div>
      <p class="inline-status">{{ story.statusMessage || '正在构思下一段…' }}</p>
    </div>

    <!-- 完成后：显示纯正文（打字机逐字呈现） -->
    <article v-else-if="narrative" class="narrative-wrap">
      <p class="narrative">
        <TypewriterText
          :text="narrative"
          :speed="config.config.typewriterSpeed"
          :instant="false"
          @done="scrollDown"
        />
      </p>
    </article>

    <!-- 错误 -->
    <div v-if="story.error" class="error-box">
      {{ story.error }}
      <button class="btn btn-ghost" @click="continueStory">重试</button>
    </div>

    <!-- 选项 -->
    <div v-if="!story.generating && choices.length && !isFinished" class="choices">
      <button
        v-for="c in choices"
        :key="c.id"
        class="choice"
        :disabled="chosenId !== null"
        @click="choose(c.id)"
      >
        <span class="choice-id">{{ c.id }}</span>
        <span class="choice-text">{{ c.text }}</span>
      </button>
    </div>

    <!-- 完结 -->
    <div v-if="isFinished" class="ending">
      <p class="ending-text">—— 故事至此完结 ——</p>
      <button class="btn btn-primary" @click="emit('novel')">将此程历程落笔成书</button>
    </div>
  </section>
</template>

<style scoped>
.story-empty {
  padding: 80px 24px;
  text-align: center;
  color: var(--fg-soft);
  line-height: 2.2;
}
.muted {
  color: var(--fg-muted);
  font-size: 14px;
}
.story {
  padding: 48px 32px 120px;
  overflow-y: auto;
}
.chapter-marker {
  text-align: center;
  font-size: 13px;
  color: var(--fg-muted);
  letter-spacing: 0.15em;
  margin-bottom: 40px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--border);
}
.narrative-wrap {
  margin-bottom: 36px;
}
.narrative {
  font-size: 18px;
  line-height: 2.1;
  letter-spacing: 0.03em;
  color: var(--fg);
  text-indent: 2em;
}
.status {
  text-align: center;
  font-size: 13px;
  color: var(--fg-muted);
  padding: 8px;
  font-style: italic;
}
.inline-loading {
  margin: 32px 0;
  text-align: center;
}
.inline-bar {
  width: 200px;
  height: 3px;
  margin: 0 auto 14px;
  background: var(--bg-soft);
  border-radius: 2px;
  overflow: hidden;
  position: relative;
}
.inline-bar-fill {
  position: absolute;
  height: 100%;
  width: 40%;
  border-radius: 2px;
  background: linear-gradient(90deg, transparent, var(--accent), transparent);
}
.inline-bar-fill.indeterminate {
  animation: indeterminate 1.4s ease-in-out infinite;
}
@keyframes indeterminate {
  0% {
    left: -40%;
  }
  100% {
    left: 100%;
  }
}
.inline-status {
  color: var(--fg-muted);
  font-size: 13px;
}
.error-box {
  margin: 16px 0;
  padding: 14px 18px;
  background: rgba(201, 122, 106, 0.1);
  border-radius: var(--radius);
  color: var(--danger);
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.choices {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 24px;
}
.choice {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  background: var(--bg-soft);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  text-align: left;
  transition: all 0.2s var(--ease);
}
.choice:hover:not(:disabled) {
  border-color: var(--accent-soft);
  background: var(--bg-elevated);
  transform: translateX(4px);
}
.choice:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.choice-id {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 1px solid var(--accent-soft);
  color: var(--accent);
  font-size: 13px;
  flex-shrink: 0;
}
.choice-text {
  font-size: 16px;
  color: var(--fg);
}
.ending {
  text-align: center;
  margin-top: 60px;
}
.ending-text {
  color: var(--fg-soft);
  letter-spacing: 0.3em;
  font-size: 15px;
}
</style>
