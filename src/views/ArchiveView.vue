<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useStoryStore } from '../stores/story'
import type { StorySave } from '@shared/types'

const storyStore = useStoryStore()
const emit = defineEmits<{ open: [] }>()

const saves = ref<StorySave[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    saves.value = await window.api.listSaves()
    saves.value.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  } finally {
    loading.value = false
  }
})

async function open(save: StorySave): Promise<void> {
  storyStore.setCurrent(save)
  emit('open')
}

async function remove(id: string): Promise<void> {
  await window.api.deleteSave(id)
  saves.value = saves.value.filter((s) => s.id !== id)
}

function progress(s: StorySave): string {
  return `第 ${s.worldState.currentChapter} 章 · ${s.rawHistory.length} 段`
}

function time(s: string): string {
  const d = new Date(s)
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
</script>

<template>
  <section class="archive reading-col">
    <h1 class="page-title">书架</h1>

    <div v-if="loading" class="empty">载入中…</div>

    <div v-else-if="saves.length === 0" class="empty">
      <p>这里还空着。</p>
      <p class="muted">开启你的第一个故事，它会被收藏在这里。</p>
    </div>

    <div v-else class="save-list">
      <article
        v-for="s in saves"
        :key="s.id"
        class="save-card"
        :class="{ finished: s.finished }"
        @click="open(s)"
      >
        <div class="save-main">
          <div class="save-title">{{ s.title }}</div>
          <div class="save-meta">
            <span class="genre-tag">{{ s.storyOutline.genre }}</span>
            <span>{{ progress(s) }}</span>
          </div>
        </div>
        <div class="save-side">
          <div class="save-time">{{ time(s.updatedAt) }}</div>
          <div v-if="s.finished" class="badge done">已完结</div>
          <div v-else class="badge ongoing">连载中</div>
          <button class="icon-btn danger" @click.stop="remove(s.id)" title="删除">删除</button>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.archive {
  padding: 48px 24px 80px;
}
.page-title {
  font-size: 26px;
  font-weight: 600;
  margin-bottom: 32px;
  letter-spacing: 0.08em;
}
.empty {
  text-align: center;
  color: var(--fg-soft);
  padding: 60px 0;
  line-height: 2.2;
}
.muted {
  color: var(--fg-muted);
  font-size: 14px;
}
.save-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.save-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 22px;
  background: var(--bg-soft);
  border: 1px solid var(--border);
  border-left: 3px solid var(--accent-soft);
  border-radius: var(--radius);
  cursor: pointer;
  transition: all 0.2s var(--ease);
}
.save-card:hover {
  border-left-color: var(--accent);
  transform: translateX(2px);
}
.save-card.finished {
  border-left-color: var(--fg-muted);
  opacity: 0.85;
}
.save-title {
  font-size: 17px;
  margin-bottom: 6px;
}
.save-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: var(--fg-muted);
}
.genre-tag {
  padding: 2px 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--accent-soft);
  font-size: 12px;
}
.save-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}
.save-time {
  font-size: 12px;
  color: var(--fg-muted);
}
.badge {
  font-size: 11px;
  padding: 2px 10px;
  border-radius: 999px;
  letter-spacing: 0.05em;
}
.badge.done {
  background: rgba(184, 176, 160, 0.15);
  color: var(--fg-soft);
}
.badge.ongoing {
  background: rgba(201, 168, 106, 0.15);
  color: var(--accent);
}
.icon-btn {
  font-size: 12px;
  color: var(--fg-muted);
  padding: 2px 6px;
  border-radius: 4px;
}
.icon-btn:hover {
  color: var(--danger);
}
</style>
