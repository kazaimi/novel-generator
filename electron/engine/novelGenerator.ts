import type {
  GeneratedNovel,
  PlayerProfile,
  RawTurn,
  StoryOutline,
  StorySave
} from '@shared/types'
import { AIClient } from '../ai/client'
import { parseLooseJson } from '../ai/parser'
import type { ChatMessage } from '../ai/client'

/**
 * 完结小说生成器。
 *
 * 把玩家整局互动的历程（rawHistory）「小说化」：
 *  1. 收集完整历程
 *  2. 生成小说蓝图（标题 + 章节划分）
 *  3. 逐章润色：统一叙事视角、补过渡、去除"选项A/B"痕迹、增文学性
 *  4. 序言 + 尾声
 *
 * 受模型池轮换与限速保护。
 */

export interface NovelProgress {
  stage: 'planning' | 'chapter' | 'preface' | 'epilogue' | 'done'
  /** 当前章节序号（chapter 阶段） */
  chapterIndex?: number
  /** 章节总数 */
  totalChapters?: number
  /** 流式增量文本（仅逐章生成时） */
  delta?: string
  /** 状态文案 */
  message: string
}

/**
 * 把历程渲染成可读文本供 LLM 参考。
 * @param maxLenPerTurn 每段正文的最大长度（截断，控制总上下文）；0 = 不截断
 * @param maxTurns 最多渲染的段数（超出的旧段以一行摘要代替）；0 = 不限制
 *
 * 防护目的：长局 rawHistory 无限增长，全量渲染会超出模型上下文窗口。
 */
function renderHistory(history: RawTurn[], maxLenPerTurn = 0, maxTurns = 0): string {
  let list = history
  let skipped = 0
  if (maxTurns > 0 && history.length > maxTurns) {
    skipped = history.length - maxTurns
    list = history.slice(-maxTurns)
  }
  const lines: string[] = []
  if (skipped > 0) {
    lines.push(`【前 ${skipped} 段（梗概）】玩家已度过故事的前期阶段，详见各章正文。`)
  }
  list.forEach((t, idx) => {
    const segNo = skipped + idx + 1
    let text = t.narrative
    if (maxLenPerTurn > 0 && text.length > maxLenPerTurn) {
      text = text.slice(0, maxLenPerTurn) + '……'
    }
    const parts = [`【第${segNo}段】${text}`]
    if (t.chosenId && t.choices.length) {
      const c = t.choices.find((x) => x.id === t.chosenId)
      if (c) parts.push(`　（玩家选择：${c.text}）`)
    }
    lines.push(parts.join('\n'))
  })
  return lines.join('\n\n')
}

/** 规划小说蓝图（标题 + 章节划分） */
interface NovelPlan {
  title: string
  author: string
  /** 每个元素是「该小说章节对应原历程的段落范围 + 标题」 */
  planChapters: { heading: string; fromSeg: number; toSeg: number; note: string }[]
}

function buildPlanMessages(
  history: RawTurn[],
  outline: StoryOutline,
  profile: PlayerProfile
): ChatMessage[] {
  const system = [
    '你是一位资深小说编辑。玩家刚刚玩完一部互动小说，现在需要把他的整局游玩历程改编成一部完整的、文学性强的小说。',
    '',
    '【原剧情蓝图】',
    `题材：${outline.genre}`,
    `设定：${outline.premise}`,
    '',
    '【玩家画像】',
    `偏好：${profile.summary}`,
    '',
    '【玩家历程（段落 + 选择）】',
    // 规划只需梗概：每段截断 150 字、最多渲染最近 80 段（防长局超上下文）
    renderHistory(history, 150, 80),
    '',
    '【任务】',
    '请规划这部小说的结构，返回 JSON：',
    '- title：一个有意境的小说标题',
    '- author：一个笔名',
    '- planChapters：将上述历程划分为 4-8 个章节，每章给出：',
    '   - heading：章节标题',
    '   - fromSeg / toSeg：对应原历程的段落编号（从1开始）',
    '   - note：本章在小说中的叙事重点（一两句话）',
    '划分应遵循起承转合，保持原剧情走向与玩家真实选择。'
  ].join('\n')
  return [
    { role: 'system', content: system } as ChatMessage,
    { role: 'user', content: '请规划。' } as ChatMessage
  ]
}

function parsePlan(raw: unknown, segCount: number): NovelPlan | null {
  if (!raw || typeof raw !== 'object') return null
  let obj = raw as Record<string, unknown>
  // 智谱等平台可能把结果包在 {"answer": {...}} / {"data": {...}} 里，需解包
  if (!Array.isArray(obj.planChapters)) {
    const inner = (obj.answer ?? obj.data ?? obj.result) as Record<string, unknown> | undefined
    if (inner && typeof inner === 'object' && Array.isArray(inner.planChapters)) {
      obj = inner
    }
  }
  const arr = Array.isArray(obj.planChapters) ? (obj.planChapters as unknown[]) : []
  const planChapters = arr
    .map((c): NovelPlan['planChapters'][number] | null => {
      if (!c || typeof c !== 'object') return null
      const o = c as Record<string, unknown>
      const from = typeof o.fromSeg === 'number' ? o.fromSeg : 1
      const to = typeof o.toSeg === 'number' ? o.toSeg : segCount
      return {
        heading: typeof o.heading === 'string' ? o.heading : '章节',
        fromSeg: Math.max(1, from),
        toSeg: Math.min(segCount, to),
        note: typeof o.note === 'string' ? o.note : ''
      }
    })
    .filter((c): c is NovelPlan['planChapters'][number] => c !== null)
  if (planChapters.length === 0) return null
  return {
    title: typeof obj.title === 'string' ? obj.title : '无题',
    author: typeof obj.author === 'string' ? obj.author : '佚名',
    planChapters
  }
}

/** 生成单章正文（流式） */
function buildChapterMessages(
  history: RawTurn[],
  pc: NovelPlan['planChapters'][number],
  fullOutline: StoryOutline,
  profile: PlayerProfile,
  prevTail: string
): ChatMessage[] {
  const segs = history.slice(pc.fromSeg - 1, pc.toSeg)
  const system = [
    `你正在把一部互动小说的游玩历程改写成正式小说。当前要写的是《${pc.heading}》。`,
    `本章叙事重点：${pc.note}`,
    `原题材：${fullOutline.genre}；设定：${fullOutline.premise}`,
    `读者画像：${profile.summary}`,
    '',
    '【本章对应的原始历程（段落 + 玩家选择）】',
    // 章节写作需要较完整上下文，但每段仍截断防爆炸（400 字足以衔接）
    renderHistory(segs, 400),
    prevTail ? `\n【上一章结尾，保持衔接】\n${prevTail}` : '',
    '',
    '【写作要求】',
    '1. 用第三人称连贯叙事（除非原历程明显是第一人称），有文学性、有画面感。',
    '2. 去除所有「选项」「玩家选择」的痕迹，把它们自然融入叙事。',
    '3. 保留玩家真实选择导致的剧情走向，这是这部小说独一无二之处。',
    '4. 与上一章结尾自然衔接，章内情节完整。',
    '5. 字数 600-1200 字。直接输出小说正文，不要标题、不要说明。'
  ]
    .filter(Boolean)
    .join('\n')
  return [
    { role: 'system', content: system } as ChatMessage,
    // 智谱等平台要求至少一条 user 消息
    { role: 'user', content: `请写出《${pc.heading}》的正文。` } as ChatMessage
  ]
}

/** 生成序言/尾声 */
function buildShortMessages(kind: 'preface' | 'epilogue', plan: NovelPlan, outline: StoryOutline): ChatMessage[] {
  const role =
    kind === 'preface'
      ? '请为这部小说写一段序言（150-250字），点出故事的核心母题与氛围，但不要剧透结局。直接输出正文。'
      : '请为这部小说写一段尾声/后记（150-250字），以作者的口吻收束，余韵悠长。直接输出正文。'
  const system = [
    `小说标题：《${plan.title}》，作者：${plan.author}`,
    `题材：${outline.genre}；设定：${outline.premise}`,
    role
  ].join('\n')
  return [
    { role: 'system', content: system } as ChatMessage,
    { role: 'user', content: kind === 'preface' ? '请写序言。' : '请写尾声。' } as ChatMessage
  ]
}

/**
 * 生成完整小说。
 * @param onProgress 进度回调（含流式 delta）
 */
export async function generateNovel(
  save: StorySave,
  onProgress: (p: NovelProgress) => void
): Promise<GeneratedNovel> {
  const { rawHistory, storyOutline, playerProfile } = save
  const client = new AIClient()

  // 1. 规划
  onProgress({ stage: 'planning', message: '正在构思小说结构…' })
  const planRaw = await client.generate(buildPlanMessages(rawHistory, storyOutline, playerProfile), {
    stream: false,
    jsonObject: true,
    temperature: 0.85
  })
  const plan = parsePlan(parseLooseJson(planRaw), rawHistory.length)
  if (!plan) throw new Error('小说结构生成失败，请重试')

  const chapters: { heading: string; content: string }[] = []
  let prevTail = ''

  // 2. 逐章生成
  for (let i = 0; i < plan.planChapters.length; i++) {
    const pc = plan.planChapters[i]
    onProgress({
      stage: 'chapter',
      chapterIndex: i + 1,
      totalChapters: plan.planChapters.length,
      message: `正在书写《${pc.heading}》…`
    })
    let chapterText = ''
    const text = await client.generate(
      buildChapterMessages(rawHistory, pc, storyOutline, playerProfile, prevTail),
      {
        stream: true,
        temperature: 0.9,
        onToken: (delta) => {
          chapterText += delta
          onProgress({
            stage: 'chapter',
            chapterIndex: i + 1,
            totalChapters: plan.planChapters.length,
            delta,
            message: `正在书写《${pc.heading}》…`
          })
        }
      }
    )
    chapters.push({ heading: pc.heading, content: text })
    prevTail = text.slice(-200) // 留结尾供下章衔接
  }

  // 3. 序言
  onProgress({ stage: 'preface', message: '正在撰写序言…' })
  const preface = await client.generate(buildShortMessages('preface', plan, storyOutline), {
    stream: true,
    temperature: 0.85
  })

  // 4. 尾声
  onProgress({ stage: 'epilogue', message: '正在撰写尾声…' })
  const epilogue = await client.generate(buildShortMessages('epilogue', plan, storyOutline), {
    stream: true,
    temperature: 0.85
  })

  onProgress({ stage: 'done', message: '小说已成。' })

  // 清理模型可能带上的"序言：/尾声："等自标注标签
  const stripLabel = (s: string): string =>
    s.replace(/^\s*(序言|尾声|后记|前言)[:：\s]*\n?/, '').trim()

  return {
    title: plan.title,
    author: plan.author,
    chapters,
    preface: stripLabel(preface),
    epilogue: stripLabel(epilogue),
    generatedAt: new Date().toISOString()
  }
}
