import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { StorySave, StoryTurn } from '@shared/types'
import { typewriterSound } from '../audio/typewriter'
import { ipc } from '../lib/ipc'

/**
 * 故事状态 store。
 * 管理当前进行中的存档、流式生成过程。
 */
export const useStoryStore = defineStore('story', () => {
  /** 当前存档 */
  const current = ref<StorySave | null>(null)
  /** 状态提示（如"切换模型中"） */
  const statusMessage = ref('')
  /** 是否正在生成 */
  const generating = ref(false)
  /** 最近一次生成结果 */
  const lastTurn = ref<StoryTurn | null>(null)
  /** 错误信息 */
  const error = ref('')

  /** 新建存档 */
  function setCurrent(save: StorySave): void {
    current.value = save
    error.value = ''
    // 续作时：若存档有历史，恢复最后一轮显示（让玩家看到上次到哪了）
    const last = save.recentTurns[save.recentTurns.length - 1]
    if (last) {
      lastTurn.value = {
        narrative: last.narrative,
        choices: last.choices,
        stateDelta: {},
        profileDelta: {},
        chapterProgress: { goalMet: false, advanceChapter: false },
        isEnding: save.finished
      }
    } else {
      lastTurn.value = null
    }
  }

  /** 用户首次交互时解锁音频 */
  function unlockAudio(): void {
    typewriterSound.unlock()
  }

  /** 触发下一轮生成（流式）。
   *  状态推进（历程/摘要/世界状态/章节）由主进程统一处理并持久化，
   *  此处只负责采纳返回的存档并更新显示状态。 */
  async function generateNext(chosenId: string | null): Promise<StoryTurn | null> {
    if (!current.value || generating.value) return null
    generating.value = true
    statusMessage.value = ''
    error.value = ''

    // 解锁音频（用户交互上下文）
    unlockAudio()

    try {
      const result = await ipc.generateNext(current.value, chosenId, (event) => {
        if (event.type === 'status') {
          statusMessage.value = event.message
        }
      })
      if (result) {
        // 采纳主进程推进后的存档（含更新后的 recentTurns/summary/worldState）
        current.value = result.save
        lastTurn.value = result.turn
        return result.turn
      }
      return null
    } catch (e) {
      error.value = (e as Error).message
      return null
    } finally {
      generating.value = false
      statusMessage.value = ''
    }
  }

  /** 持久化当前存档 */
  async function persist(): Promise<void> {
    if (current.value) {
      await ipc.saveStory(current.value)
    }
  }

  /** 取消生成 */
  async function cancel(): Promise<void> {
    await ipc.cancelGenerate()
  }

  return {
    current,
    statusMessage,
    generating,
    lastTurn,
    error,
    setCurrent,
    unlockAudio,
    generateNext,
    persist,
    cancel
  }
})
