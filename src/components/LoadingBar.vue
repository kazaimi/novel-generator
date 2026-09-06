<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'

/**
 * 加载进度条。
 *
 * AI 生成无法预知总时长，所以采用「阶段式」进度：
 * 按已用时间推进到不同阶段（30%→55%→75%→88%→95%），最后一小段留到真正完成。
 * 这样用户始终看到进度在动，而非干等转圈。
 *
 * status 文案会实时显示（如"切换模型中…"）。
 */
const props = withDefaults(
  defineProps<{
    /** 是否加载中 */
    active: boolean
    /** 状态文案 */
    status?: string
    /** 标题 */
    title?: string
  }>(),
  {
    status: '',
    title: '正在生成…'
  }
)

const progress = ref(0)
let timer: ReturnType<typeof setInterval> | null = null
const startTime = ref(0)

function start(): void {
  progress.value = 5
  startTime.value = Date.now()
  clearTimer()
  timer = setInterval(() => {
    const elapsed = (Date.now() - startTime.value) / 1000
    // 阶段式推进：越接近完成越慢，但永不到 100
    let target: number
    if (elapsed < 3) target = 5 + (elapsed / 3) * 25 // → 30%
    else if (elapsed < 8) target = 30 + ((elapsed - 3) / 5) * 25 // → 55%
    else if (elapsed < 15) target = 55 + ((elapsed - 8) / 7) * 20 // → 75%
    else if (elapsed < 25) target = 75 + ((elapsed - 15) / 10) * 13 // → 88%
    else target = Math.min(95, 88 + (elapsed - 25) * 0.3) // → 缓慢爬向 95%
    progress.value = Math.min(95, target)
  }, 200)
}

function clearTimer(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

/** 完成时快速冲到 100% 再淡出 */
function finish(): void {
  clearTimer()
  progress.value = 100
}

watch(
  () => props.active,
  (active) => {
    if (active) start()
    else finish()
  }
)

onMounted(() => {
  if (props.active) start()
})

onBeforeUnmount(clearTimer)
</script>

<template>
  <div class="loading" v-if="active || progress > 0">
    <div class="loading-inner">
      <div class="loading-title">{{ title }}</div>
      <div class="bar-wrap">
        <div class="bar-fill" :style="{ width: progress + '%' }" />
      </div>
      <div class="loading-status" v-if="status">{{ status }}</div>
      <div class="loading-percent">{{ Math.round(progress) }}%</div>
    </div>
  </div>
</template>

<style scoped>
.loading {
  text-align: center;
  padding: 48px 24px;
}
.loading-inner {
  max-width: 360px;
  margin: 0 auto;
}
.loading-title {
  color: var(--accent);
  font-size: 16px;
  letter-spacing: 0.08em;
  margin-bottom: 18px;
}
.bar-wrap {
  width: 100%;
  height: 4px;
  background: var(--bg-soft);
  border-radius: 2px;
  overflow: hidden;
}
.bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent-soft), var(--accent));
  border-radius: 2px;
  transition: width 0.3s var(--ease);
}
.loading-status {
  margin-top: 14px;
  color: var(--fg-muted);
  font-size: 13px;
  min-height: 18px;
}
.loading-percent {
  margin-top: 6px;
  color: var(--fg-muted);
  font-size: 12px;
}
</style>
