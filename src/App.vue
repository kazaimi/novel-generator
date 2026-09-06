<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useConfigStore } from './stores/config'
import StartView from './views/StartView.vue'
import IntroView from './views/IntroView.vue'
import StoryView from './views/StoryView.vue'
import NovelView from './views/NovelView.vue'
import ArchiveView from './views/ArchiveView.vue'
import SettingsView from './views/SettingsView.vue'

type View = 'start' | 'intro' | 'story' | 'novel' | 'archive' | 'settings'

const configStore = useConfigStore()
const view = ref<View>('start')

function go(v: View): void {
  view.value = v
}

function onIntroDone(): void {
  // IntroView 完成后已设置 storyStore.current，进入故事
  go('story')
}

onMounted(async () => {
  await configStore.load()
})
</script>

<template>
  <div class="app-shell">
    <!-- 极简顶栏 -->
    <header class="topbar">
      <div class="brand" @click="go('start')">
        <span class="brand-mark">墨</span>
        <span class="brand-text">小说生成器</span>
      </div>
      <nav class="nav">
        <button class="nav-btn" :class="{ active: view === 'start' }" @click="go('start')">开始</button>
        <button class="nav-btn" :class="{ active: view === 'archive' }" @click="go('archive')">书架</button>
        <button class="nav-btn" :class="{ active: view === 'settings' }" @click="go('settings')">设置</button>
      </nav>
    </header>

    <main class="content">
      <Transition name="fade" mode="out-in">
        <StartView v-if="view === 'start'" @start="go('intro')" @continue="go('story')" />
        <IntroView v-else-if="view === 'intro'" @done="onIntroDone" />
        <StoryView v-else-if="view === 'story'" @novel="go('novel')" />
        <NovelView v-else-if="view === 'novel'" @back="go('story')" />
        <ArchiveView v-else-if="view === 'archive'" @open="go('story')" />
        <SettingsView v-else-if="view === 'settings'" />
      </Transition>
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
}
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 32px;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
  flex-shrink: 0;
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
}
.brand-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--accent);
  color: var(--bg);
  font-weight: 700;
  font-size: 16px;
}
.brand-text {
  font-size: 16px;
  letter-spacing: 0.1em;
  color: var(--fg-soft);
}
.nav {
  display: flex;
  gap: 4px;
}
.nav-btn {
  padding: 8px 18px;
  font-size: 14px;
  color: var(--fg-muted);
  border-radius: var(--radius);
  letter-spacing: 0.08em;
  transition: all 0.2s var(--ease);
}
.nav-btn:hover {
  color: var(--fg);
}
.nav-btn.active {
  color: var(--accent);
  background: var(--bg-soft);
}
.content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}
</style>
