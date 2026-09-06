<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useStoryStore } from '../stores/story'
import { ipc } from '../lib/ipc'
import LoadingBar from '../components/LoadingBar.vue'
import type { GeneratedNovel } from '@shared/types'

const story = useStoryStore()
const emit = defineEmits<{ back: [] }>()

const phase = ref<'idle' | 'generating' | 'done' | 'error'>('idle')
const statusText = ref('正在构思小说结构…')
const novel = ref<GeneratedNovel | null>(null)
const errorMsg = ref('')
const exportDone = ref('')

onMounted(async () => {
  // 若存档已有小说，直接展示
  if (story.current?.novel) {
    novel.value = story.current.novel
    phase.value = 'done'
  }
})

async function generate(): Promise<void> {
  if (!story.current) return
  phase.value = 'generating'
  errorMsg.value = ''
  // 状态文案轮转，让等待不枯燥
  const phrases = [
    '正在构思小说结构…',
    '正在书写第一章…',
    '字斟句酌，落笔成章…',
    '正在收束故事…',
    '正在撰写序言与尾声…'
  ]
  let i = 0
  const timer = setInterval(() => {
    statusText.value = phrases[i % phrases.length]
    i++
  }, 4000)

  try {
    const result = await ipc.generateNovel(story.current)
    if (result.ok) {
      novel.value = result.novel
      story.current.novel = result.novel
      story.current.finished = true
      phase.value = 'done'
    } else {
      errorMsg.value = result.error
      phase.value = 'error'
    }
  } catch (e) {
    errorMsg.value = (e as Error).message
    phase.value = 'error'
  } finally {
    clearInterval(timer)
  }
}

async function exportAs(format: 'txt' | 'markdown'): Promise<void> {
  if (!novel.value) return
  const res = await ipc.exportNovel(novel.value, format)
  if (res.ok) {
    exportDone.value = `已导出到：${res.path}`
  } else {
    exportDone.value = res.error ?? '导出失败'
  }
  setTimeout(() => (exportDone.value = ''), 4000)
}
</script>

<template>
  <section class="novel reading-col">
    <!-- 未生成：触发按钮 -->
    <div v-if="phase === 'idle'" class="cta">
      <p class="cta-title">故事已成，是时候落笔成书了。</p>
      <p class="cta-sub">AI 将依据你的整段历程，编织一部独一无二的小说。</p>
      <button class="btn btn-primary big" @click="generate">开始书写</button>
      <button class="btn-ghost btn" @click="emit('back')">返回</button>
    </div>

    <!-- 生成中 -->
    <LoadingBar
      v-if="phase === 'generating'"
      :active="phase === 'generating'"
      title="正在书写你的小说"
      :status="statusText"
    />

    <!-- 错误 -->
    <div v-if="phase === 'error'" class="error-box">
      <p>{{ errorMsg }}</p>
      <button class="btn" @click="generate">重试</button>
    </div>

    <!-- 完成：展示小说 -->
    <article v-if="phase === 'done' && novel" class="book">
      <header class="book-head">
        <h1 class="book-title">{{ novel.title }}</h1>
        <p class="book-author">— {{ novel.author }} 著</p>
      </header>

      <section class="book-section">
        <h2 class="sec-title">序</h2>
        <p class="sec-body">{{ novel.preface }}</p>
      </section>

      <section v-for="(ch, i) in novel.chapters" :key="i" class="book-section">
        <h2 class="sec-title">{{ ch.heading }}</h2>
        <p class="sec-body">{{ ch.content }}</p>
      </section>

      <section class="book-section">
        <h2 class="sec-title">尾声</h2>
        <p class="sec-body">{{ novel.epilogue }}</p>
      </section>

      <footer class="book-foot">
        <span class="end-mark">—— 全文完 ——</span>
        <div class="export-row">
          <button class="btn" @click="exportAs('markdown')">导出 Markdown</button>
          <button class="btn" @click="exportAs('txt')">导出 TXT</button>
        </div>
        <p v-if="exportDone" class="export-tip">{{ exportDone }}</p>
      </footer>
    </article>
  </section>
</template>

<style scoped>
.novel {
  padding: 56px 32px 100px;
}
.cta {
  text-align: center;
  padding: 60px 0;
}
.cta-title {
  font-size: 22px;
  color: var(--fg);
  margin-bottom: 12px;
  letter-spacing: 0.05em;
}
.cta-sub {
  color: var(--fg-soft);
  font-size: 15px;
  margin-bottom: 36px;
}
.big {
  padding: 14px 40px;
  font-size: 16px;
  margin-bottom: 12px;
}
.generating {
  text-align: center;
  padding: 60px 0;
}
.spinner {
  width: 36px;
  height: 36px;
  margin: 0 auto 24px;
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
.status {
  color: var(--accent);
  font-size: 15px;
  margin-bottom: 24px;
}
.streaming-text {
  text-align: left;
  color: var(--fg-muted);
  font-size: 14px;
  line-height: 1.9;
  max-height: 300px;
  overflow-y: auto;
  padding: 16px;
  background: var(--bg-soft);
  border-radius: var(--radius);
}
.error-box {
  text-align: center;
  padding: 40px;
  color: var(--danger);
}
.book-head {
  text-align: center;
  margin-bottom: 56px;
  padding-bottom: 28px;
  border-bottom: 1px solid var(--border);
}
.book-title {
  font-size: 30px;
  font-weight: 600;
  letter-spacing: 0.1em;
  margin-bottom: 10px;
}
.book-author {
  color: var(--fg-muted);
  font-size: 14px;
  letter-spacing: 0.1em;
}
.book-section {
  margin-bottom: 48px;
}
.sec-title {
  font-size: 19px;
  font-weight: 600;
  color: var(--accent);
  margin-bottom: 18px;
  letter-spacing: 0.08em;
  text-align: center;
}
.sec-body {
  font-size: 17px;
  line-height: 2.1;
  letter-spacing: 0.03em;
  color: var(--fg);
  text-indent: 2em;
}
.book-foot {
  text-align: center;
  margin-top: 60px;
  padding-top: 32px;
  border-top: 1px solid var(--border);
}
.end-mark {
  color: var(--fg-soft);
  letter-spacing: 0.4em;
  font-size: 14px;
  display: block;
  margin-bottom: 24px;
}
.export-row {
  display: flex;
  gap: 12px;
  justify-content: center;
}
.export-tip {
  margin-top: 14px;
  font-size: 13px;
  color: var(--accent-soft);
}
</style>
