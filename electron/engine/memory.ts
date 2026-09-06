import type { RawTurn, StorySave, StoryTurn } from '@shared/types'
import { AIClient } from '../ai/client'

/**
 * 记忆管理模块。
 *
 * 统一在主进程维护存档的三层记忆：
 *  - rawHistory   完整历程（永久，供成书）
 *  - recentTurns  近期原文窗口（超过窗口时逐出旧轮）
 *  - summary      逐出内容的 LLM 压缩摘要（失败时降级为拼接截断）
 *  - worldState   物品/标记/章节进度
 */

/** 近期原文窗口大小 */
const RECENT_WINDOW = 8

/** 摘要压缩的最大长度（字） */
const SUMMARY_MAX = 500

/**
 * 把一轮生成结果应用到存档：
 * 记录历程 → 管理窗口 → 压缩摘要 → 更新世界状态与章节推进。
 * 直接修改传入的 save 对象。
 */
export async function applyTurnToSave(
  save: StorySave,
  turn: StoryTurn,
  chosenId: string | null
): Promise<void> {
  // 1. 上一轮补记玩家选择
  const lastRaw = save.recentTurns[save.recentTurns.length - 1]
  if (lastRaw) lastRaw.chosenId = chosenId

  // 2. 本轮入档
  const raw: RawTurn = {
    narrative: turn.narrative,
    choices: turn.choices,
    chosenId: null,
    ts: new Date().toISOString()
  }
  save.rawHistory.push(raw)
  save.recentTurns.push(raw)

  // 3. 窗口管理：逐出旧轮并压缩摘要
  if (save.recentTurns.length > RECENT_WINDOW) {
    const dropped = save.recentTurns.slice(0, save.recentTurns.length - RECENT_WINDOW)
    save.recentTurns = save.recentTurns.slice(-RECENT_WINDOW)
    save.summary = await compressSummary(save.summary, dropped)
  }

  // 4. 世界状态增量
  const sd = turn.stateDelta
  if (sd.inventory?.length) save.worldState.inventory.push(...sd.inventory)
  if (sd.flags) Object.assign(save.worldState.flags, sd.flags)
  if (sd.npcs) Object.assign(save.worldState.npcs, sd.npcs)

  // 5. 章节推进：AI 明确要求，或轮数达到蓝图预计（规则兜底，防死循环）
  save.worldState.chapterTurnCount += 1
  const chapter = save.storyOutline.chapters.find(
    (c) => c.index === save.worldState.currentChapter
  )
  const shouldAdvance =
    turn.chapterProgress.advanceChapter ||
    (chapter !== undefined && save.worldState.chapterTurnCount >= chapter.estTurns)
  if (shouldAdvance && save.worldState.currentChapter < save.storyOutline.chapters.length) {
    save.worldState.currentChapter += 1
    save.worldState.chapterTurnCount = 0
  }

  // 6. 结局
  if (turn.isEnding) save.finished = true
}

/**
 * 用 LLM 把「旧摘要 + 逐出片段」压缩成新的连贯摘要。
 * 失败时降级为「拼接 + 尾部截断」。
 */
export async function compressSummary(
  oldSummary: string,
  dropped: RawTurn[]
): Promise<string> {
  const droppedText = dropped.map((t) => t.narrative).join('\n')
  try {
    const client = new AIClient()
    const text = await client.generate(
      [
        {
          role: 'system',
          content: [
            '你是剧情记录员。请把「已有摘要」与「新增剧情片段」合并压缩成一份连贯的剧情摘要。',
            `要求：不超过 ${SUMMARY_MAX} 字；必须保留：关键事件的因果链、人物姓名与关系、获得的重要物品、尚未解决的伏笔；省略次要描写。`,
            '只输出摘要正文，不要任何标题、前缀或解释。'
          ].join('\n')
        },
        {
          role: 'user',
          content: `【已有摘要】\n${oldSummary || '（暂无）'}\n\n【新增剧情片段】\n${droppedText}`
        }
      ],
      {
        stream: false,
        temperature: 0.3,
        retriesPerModel: 1
      }
    )
    const cleaned = text.trim()
    if (cleaned.length >= 20) return cleaned.slice(-SUMMARY_MAX * 2)
    throw new Error('摘要过短')
  } catch {
    // 降级：拼接 + 尾部截断
    return (oldSummary + '\n' + droppedText).slice(-4000)
  }
}
