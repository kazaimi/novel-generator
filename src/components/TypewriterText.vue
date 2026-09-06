<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue'
import { typewriterSound } from '../audio/typewriter'

/**
 * 打字机文本组件：逐字显示内容，伴随打字音效。
 * 通过 :text 传入完整文本，组件内部逐字呈现。
 * 支持 :instant 跳过动画，:speed 控制每字毫秒数。
 */
const props = withDefaults(
  defineProps<{
    text: string
    speed?: number
    instant?: boolean
    sound?: boolean
  }>(),
  {
    speed: 55,
    instant: false,
    sound: true
  }
)

const emit = defineEmits<{
  done: []
}>()

const displayed = ref('')
let timer: ReturnType<typeof setInterval> | null = null
let charIndex = 0

function clearTimer(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

function type(): void {
  clearTimer()
  charIndex = 0
  displayed.value = ''

  if (props.instant || !props.text) {
    displayed.value = props.text
    emit('done')
    return
  }

  timer = setInterval(() => {
    if (charIndex >= props.text.length) {
      clearTimer()
      emit('done')
      return
    }
    const ch = props.text[charIndex]
    displayed.value += ch
    charIndex++

    // 仅对可见字符播放音效（跳过空白与标点时偶尔触发，更像真实打字）
    if (props.sound && /\S/.test(ch) && Math.random() > 0.15) {
      typewriterSound.click()
    }
  }, props.speed)
}

watch(
  () => [props.text, props.speed, props.instant],
  () => type(),
  { immediate: true }
)

/** 跳过动画，直接显示全文 */
function skip(): void {
  clearTimer()
  displayed.value = props.text
  emit('done')
}

defineExpose({ skip })

onBeforeUnmount(clearTimer)
</script>

<template>
  <span class="typewriter" @click="skip">
    {{ displayed }}<span v-if="displayed.length < text.length" class="cursor">▏</span>
  </span>
</template>

<style scoped>
.typewriter {
  white-space: pre-wrap;
  word-break: break-word;
}
.cursor {
  display: inline-block;
  margin-left: 1px;
  color: var(--accent);
  animation: blink 1s steps(2) infinite;
}
@keyframes blink {
  50% {
    opacity: 0;
  }
}
</style>
