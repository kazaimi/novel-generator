import type {
  PlayerProfile,
  StoryOutline,
  StoryChoice,
  StorySave
} from '@shared/types'
import type { DirectorDirective } from '../engine/director'
import type { ChatMessage } from './client'

/**
 * 生成剧情的 JSON Schema（用于结构化输出）。
 * 模型支持 response_format: json_schema 时启用。
 */
export const STORY_TURN_SCHEMA = {
  type: 'object',
  properties: {
    narrative: { type: 'string', description: '本段正文，严格遵循长度要求' },
    choices: {
      type: 'array',
      minItems: 3,
      maxItems: 3,
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'A/B/C' },
          text: { type: 'string', description: '选项描述，简短有画面感' },
          tags: { type: 'array', items: { type: 'string' } }
        },
        required: ['id', 'text']
      }
    },
    state_delta: {
      type: 'object',
      properties: {
        inventory: { type: 'array', items: { type: 'string' } },
        flags: { type: 'object' }
      }
    },
    profile_delta: { type: 'object' },
    chapter_progress: {
      type: 'object',
      properties: {
        goal_met: { type: 'boolean' },
        advance_chapter: { type: 'boolean' }
      }
    },
    is_ending: { type: 'boolean' }
  },
  required: ['narrative', 'choices', 'is_ending']
}

/** 玩家画像 → 自然语言 */
function profileToText(p: PlayerProfile): string {
  const parts: string[] = []
  parts.push(
    p.riskTolerance >= 0 ? '偏好冒险与挑战' : '偏好安稳与周全'
  )
  parts.push(p.tone >= 0 ? '倾向明亮温暖' : '倾向深沉幽暗')
  parts.push(p.pace >= 0 ? '偏好快节奏' : '偏好慢热细腻')
  parts.push(p.heart >= 0 ? '重情感与羁绊' : '重理性与逻辑')
  parts.push(`题材偏好：${p.genrePreference}`)
  if (p.summary) parts.push(`综合画像：${p.summary}`)
  // 游玩过程中累积的行为倾向（AI 每轮观察所得），让叙事逐步贴合玩家
  if (p.evolvingNotes?.length) {
    parts.push(`近期行为倾向（据此微调剧情走向与选项设计）：${p.evolvingNotes.slice(-6).join('；')}`)
  }
  return parts.join('；')
}

/**
 * 结局兜底：处于最后一章且轮数已达预计时，强制要求 AI 开始收束结局。
 * 否则弱模型可能无限停在最后一章，玩家永远到不了"完结"。
 */
function shouldForceEnding(save: StorySave): string {
  const { storyOutline, worldState } = save
  const last = storyOutline.chapters[storyOutline.chapters.length - 1]
  if (!last || worldState.currentChapter < last.index) return ''
  if (worldState.chapterTurnCount < last.estTurns) return ''
  return '【收束指令】故事已到尾声阶段：本段必须将剧情引向最终结局——收束主要伏笔、给出结局走向，并在 JSON 中将 is_ending 设为 true。不要再开启新的事件线。'
}

/** 组装生成下一轮的系统提示 */
export function buildStoryMessages(
  save: StorySave,
  chosenId: string | null,
  directive: DirectorDirective
): ChatMessage[] {
  const { storyOutline, playerProfile, summary, recentTurns, worldState } = save

  const systemContent = [
    `你是一位顶尖的互动小说作者。你正在创作一部「${storyOutline.genre}」类型的互动小说。`,
    `核心设定：${storyOutline.premise}`,
    `世界观：${storyOutline.worldSetting}`,
    '',
    '【剧情管理员指令 —— 必须严格遵守】',
    `当前进度：第 ${directive.chapter} 章《${directive.chapterTitle}》（${directive.actPhase}）`,
    `本章目标：${directive.chapterGoal}`,
    `情绪目标：紧张度 ${directive.tensionTarget}/5（5 最紧张）`,
    `节奏提示：${directive.pacingNote}`,
    `正文长度：${directive.lengthGuide}。这是硬性要求：narrative 不得少于 150 字，要写足场景、动作、心理与环境细节，不允许一笔带过。`,
    `类型守卫：${directive.genreGuard}`,
    shouldForceEnding(save),
    '',
    '【一致性约束 —— 不得违背或遗忘】',
    directive.continuityKeys.length
      ? directive.continuityKeys.map((k) => `- ${k}`).join('\n')
      : '- （暂无关键事件）',
    '',
    '【玩家画像 —— 据此调整叙事侧重，但不直接说破】',
    profileToText(playerProfile),
    '',
    '【历史摘要】',
    summary || '（故事刚刚开始）',
    '',
    '【输出要求 —— 必须严格遵守】',
    '你必须返回一个合法的 JSON 对象，不要返回纯文本，不要加任何解释，不要用 markdown 代码块包裹。',
    '直接输出以 { 开头、以 } 结尾的 JSON。',
    '',
    'JSON 字段：',
    '- narrative: 本段正文，150字以上，有场景描写、人物动作与心理，与历史一致',
    '- choices: 恰好 3 个选项，每个 {id:"A/B/C", text:"与正文情境紧密相关的简短选项"}。选项必须紧扣刚才正文描述的具体情境，不要用泛泛的选项。',
    '- state_delta: {inventory:[新物品], flags:{事件:值}}',
    '- chapter_progress: {goal_met: 是否达成章节目标, advance_chapter: 是否进入下一章}',
    '- is_ending: 是否为结局',
    '',
    '【输出范例（仅示意格式，实际内容依剧情而定）】',
    '{"narrative":"林间小径尽头，一扇锈迹斑斑的铁门半掩着，门缝里透出微弱的光。你听见门内传来低沉的呜咽，像是什么生物受了伤。","choices":[{"id":"A","text":"推门而入，查看情况"},{"id":"B","text":"贴着门缝偷听一会儿"},{"id":"C","text":"绕到屋后找别的入口"}],"state_delta":{},"chapter_progress":{"goal_met":false,"advance_chapter":false},"is_ending":false}',
    '',
    '再次强调：只返回 JSON，第一个字符必须是 { ，最后一个字符必须是 } 。'
  ].join('\n')

  const messages: ChatMessage[] = [{ role: 'system', content: systemContent }]

  // 近几轮原文作为上下文
  const ctx = recentTurns.slice(-4)
  for (const t of ctx) {
    messages.push({
      role: 'assistant',
      content: t.narrative
    })
    if (t.chosenId) {
      const chosen = t.choices.find((c) => c.id === t.chosenId)
      messages.push({
        role: 'user',
        content: chosen ? `（玩家选择了：${chosen.text}）` : '（玩家做出了选择）'
      })
    }
  }

  // 本轮玩家选择
  if (chosenId) {
    const last = ctx[ctx.length - 1]
    const choice: StoryChoice | undefined = last?.choices.find((c) => c.id === chosenId)
    messages.push({
      role: 'user',
      content: choice ? `我选择：${choice.text}` : '我做出了选择，请继续。'
    })
  }

  // 兼容性：智谱/GLM 等平台要求至少有一条 user 消息，
  // 第一章（无历史、chosenId 为 null）时补一条引导消息
  if (!messages.some((m) => m.role === 'user')) {
    const ch = save.storyOutline.chapters.find((c) => c.index === save.worldState.currentChapter)
    messages.push({
      role: 'user',
      content: ch
        ? `请开始第 ${ch.index} 章《${ch.title}》：${ch.goal}。现在请生成开头。`
        : '请开始故事的开篇。'
    })
  }

  return messages
}

/** 把模型返回的松散对象规范化为 StoryTurn */
export interface NormalizedTurn {
  narrative: string
  choices: StoryChoice[]
  stateDelta: import('@shared/types').WorldStateDelta
  profileDelta: import('@shared/types').ProfileDelta
  chapterProgress: { goalMet: boolean; advanceChapter: boolean }
  isEnding: boolean
}

export function normalizeTurn(raw: unknown): NormalizedTurn | null {
  if (!raw || typeof raw !== 'object') return null
  let obj = raw as Record<string, unknown>
  // 智谱等平台可能把结果包在 {"answer": {...}} / {"data": {...}} 里，需解包
  if (typeof obj.narrative !== 'string') {
    const inner = (obj.answer ?? obj.data ?? obj.result) as Record<string, unknown> | undefined
    if (inner && typeof inner === 'object' && typeof inner.narrative === 'string') {
      obj = inner
    }
  }
  const narrative = typeof obj.narrative === 'string' ? obj.narrative : ''
  if (!narrative) return null

  let choices: StoryChoice[] = []
  if (Array.isArray(obj.choices)) {
    choices = (obj.choices as unknown[])
      .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
      .map((c, i) => ({
        id: typeof c.id === 'string' ? c.id : String.fromCharCode(65 + i),
        text: typeof c.text === 'string' ? c.text : String(c.text ?? ''),
        tags: Array.isArray(c.tags) ? (c.tags as string[]) : undefined
      }))
      .filter((c) => c.text)
  }
  if (choices.length === 0) {
    // 没有选项时补 3 个通用选项，保证流程不卡
    choices = [
      { id: 'A', text: '继续向前' },
      { id: 'B', text: '稍作停留观察' },
      { id: 'C', text: '尝试另一种方式' }
    ]
  }

  const stateDelta = (obj.state_delta ?? obj.stateDelta ?? {}) as NormalizedTurn['stateDelta']
  const profileDelta = (obj.profile_delta ?? obj.profileDelta ?? {}) as NormalizedTurn['profileDelta']
  const cp = (obj.chapter_progress ?? obj.chapterProgress ?? {}) as Record<string, unknown>
  const chapterProgress = {
    goalMet: cp.goal_met === true || cp.goalMet === true,
    advanceChapter: cp.advance_chapter === true || cp.advanceChapter === true
  }
  const isEnding = obj.is_ending === true || obj.isEnding === true

  return { narrative, choices, stateDelta, profileDelta, chapterProgress, isEnding }
}
