<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useStoryStore } from '../stores/story'
import { typewriterSound } from '../audio/typewriter'
import { ipc } from '../lib/ipc'
import TypewriterText from '../components/TypewriterText.vue'
import LoadingBar from '../components/LoadingBar.vue'
import type { IntroQuestion } from '@shared/types'

const story = useStoryStore()
const emit = defineEmits<{ done: [] }>()

const questions = ref<IntroQuestion[]>([])
const current = ref(0)
const answers = ref<Record<string, number>>({})
const phase = ref<'asking' | 'generating' | 'error'>('asking')
const errorMsg = ref('')
const statusText = ref('')

/** 题干是否打完字（控制选项淡入） */
const promptDone = ref(false)

onMounted(async () => {
  typewriterSound.unlock()
  questions.value = await window.api.getIntroQuestions()
})

const q = computed(() => questions.value[current.value])

const introText = '在故事开始之前，先问你几个看似无关的小问题。'

function choose(idx: number): void {
  if (!q.value) return
  answers.value[q.value.id] = idx
  if (current.value < questions.value.length - 1) {
    current.value += 1
    promptDone.value = false
  } else {
    void finish()
  }
}

async function finish(): Promise<void> {
  phase.value = 'generating'
  statusText.value = '正在解读你的回答…'
  try {
    statusText.value = 'AI 正在为你量身定制世界与剧情…'
    const save = await ipc.startIntro(answers.value)
    story.setCurrent(save)
    emit('done')
  } catch (e) {
    const err = e as Error
    errorMsg.value = err.message || JSON.stringify(e)
    phase.value = 'error'
  }
}

/** 重新生成蓝图（保留答题结果） */
function retryGenerate(): void {
  void finish()
}

/** 重新答题 */
function retry(): void {
  phase.value = 'asking'
  current.value = 0
  answers.value = {}
}
</script>

<template>
  <section class="intro reading-col">
    <!-- 介绍语 -->
    <div v-if="current === 0 && phase === 'asking'" class="intro-line">
      <TypewriterText :text="introText" :speed="70" @done="promptDone = true" />
    </div>

    <!-- 答题 -->
    <div v-if="phase === 'asking' && q" class="question-wrap" :key="q.id">
      <div class="progress">
        <span
          v-for="(_, i) in questions"
          :key="i"
          class="dot"
          :class="{ done: i < current, active: i === current }"
        />
      </div>

      <p class="prompt">
        <TypewriterText :text="q.prompt" :speed="45" @done="promptDone = true" />
      </p>

      <Transition name="fade">
        <div v-if="promptDone" class="options">
          <button
            v-for="(opt, i) in q.options"
            :key="i"
            class="option"
            @click="choose(i)"
          >
            {{ opt.text }}
          </button>
        </div>
      </Transition>
    </div>

    <!-- 生成中 -->
    <LoadingBar
      v-if="phase === 'generating'"
      :active="phase === 'generating'"
      title="AI 正在为你量身定制世界与剧情"
      :status="statusText"
    />

    <!-- 错误 -->
    <div v-if="phase === 'error'" class="error-box">
      <p class="error-title">生成未能完成</p>
      <p class="error-detail">{{ errorMsg }}</p>
      <p class="error-hint" v-if="errorMsg.includes('429')">
        免费模型当前限速繁忙。你的答题已保留，稍等片刻后重试即可。
      </p>
      <div class="error-actions">
        <button class="btn btn-primary" @click="retryGenerate">重试生成</button>
        <button class="btn" @click="retry">重新答题</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.intro {
  padding: 72px 24px 80px;
}
.intro-line {
  font-size: 20px;
  color: var(--fg-soft);
  line-height: 2;
  text-align: center;
  margin-bottom: 48px;
  letter-spacing: 0.05em;
}
.question-wrap {
  animation: fadeIn 0.5s var(--ease);
}
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}
.progress {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-bottom: 48px;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--border);
  transition: all 0.3s var(--ease);
}
.dot.active {
  background: var(--accent);
  transform: scale(1.3);
}
.dot.done {
  background: var(--accent-soft);
}
.prompt {
  font-size: 19px;
  line-height: 2.1;
  letter-spacing: 0.04em;
  color: var(--fg);
  margin-bottom: 40px;
  min-height: 120px;
}
.options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.option {
  padding: 16px 22px;
  background: var(--bg-soft);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  text-align: left;
  font-size: 16px;
  line-height: 1.7;
  color: var(--fg);
  transition: all 0.2s var(--ease);
}
.option:hover {
  border-color: var(--accent-soft);
  background: var(--bg-elevated);
  transform: translateX(4px);
}
.generating {
  text-align: center;
  padding: 80px 0;
}
.spinner {
  width: 36px;
  height: 36px;
  margin: 0 auto 28px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.9s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.status-text {
  color: var(--accent);
  font-size: 16px;
  margin-bottom: 8px;
}
.hint {
  color: var(--fg-muted);
  font-size: 13px;
}
.error-box {
  text-align: center;
  padding: 48px 24px;
}
.error-title {
  color: var(--danger);
  font-size: 18px;
  margin-bottom: 12px;
}
.error-detail {
  color: var(--fg-soft);
  font-size: 14px;
  margin-bottom: 12px;
  word-break: break-all;
}
.error-hint {
  color: var(--accent-soft);
  font-size: 13px;
  margin-bottom: 24px;
}
.error-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}
.error-box .btn {
  margin-top: 16px;
}
</style>
