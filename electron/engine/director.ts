import type { OutlineChapter, StoryOutline, WorldState, PlayerProfile } from '@shared/types'

/**
 * 每轮导演指令 —— 由 Director 基于章节进度与情绪曲线纯规则推导得出，
 * 不额外调用 LLM（省配额、零延迟）。
 */
export interface DirectorDirective {
  /** 当前章节 */
  chapter: number
  chapterTitle: string
  /** 启承转合阶段 */
  actPhase: OutlineChapter['act']
  /** 本段目标紧张度 1-5 */
  tensionTarget: number
  /** 节奏提示 */
  pacingNote: string
  /** 正文长度范围 */
  lengthGuide: string
  /** 类型守卫 */
  genreGuard: string
  /** 本章核心目标 */
  chapterGoal: string
  /** 一致性锚点：已发生的关键事实 */
  continuityKeys: string[]
}

const LENGTH_BY_TENSION: Record<number, string> = {
  1: '约 180-200 字',
  2: '约 180-210 字',
  3: '约 190-220 字',
  4: '约 200-220 字',
  5: '约 200-220 字'
}

/** 根据启承转合与紧张度给出节奏提示 */
function pacingForPhase(act: OutlineChapter['act'], tension: number, turnInChapter: number): string {
  const isFirst = turnInChapter <= 1
  switch (act) {
    case '起':
      return isFirst ? '徐徐展开，介绍人物与世界，营造氛围，暂不引入冲突' : '埋下伏笔，制造好奇，节奏舒缓'
    case '承':
      if (tension <= 2) return '一段舒缓的日常或铺垫，让玩家喘息'
      if (tension <= 3) return '制造悬念并铺展线索，节奏适中'
      return '推进冲突，紧张感上升，但暂不揭示真相'
    case '转':
      if (isFirst) return '陡然引入反转或危机，冲击感强'
      return '高潮持续，情绪激烈，矛盾集中爆发'
    case '合':
      return '收束情节，回应伏笔，情绪缓和，给出余韵'
    default:
      return '节奏适中'
  }
}

/**
 * 从世界状态中提取关键事实作为一致性锚点。
 * 强制注入 prompt，保证前后逻辑连贯、不遗忘已发生事件。
 */
function extractContinuityKeys(worldState: WorldState): string[] {
  const keys: string[] = []
  if (worldState.inventory.length) {
    keys.push(`持有物品：${worldState.inventory.join('、')}`)
  }
  const importantFlags = Object.entries(worldState.flags)
    .filter(([, v]) => v)
    .slice(0, 8)
  for (const [k, v] of importantFlags) {
    keys.push(v === true ? `已发生：${k}` : `${k}：${String(v)}`)
  }
  const npcs = Object.entries(worldState.npcs).slice(0, 6)
  for (const [name, relation] of npcs) {
    keys.push(`角色 ${name}（${relation}）`)
  }
  return keys
}

/**
 * 推导当前这一轮的导演指令。
 * 纯规则计算，不调用 LLM。
 */
export function deriveDirective(
  outline: StoryOutline,
  worldState: WorldState,
  profile: PlayerProfile
): DirectorDirective {
  const chapterIndex = Math.min(worldState.currentChapter, outline.chapters.length)
  const chapter: OutlineChapter =
    outline.chapters.find((c) => c.index === chapterIndex) ?? outline.chapters[outline.chapters.length - 1]

  const tensionTarget = chapter.tension

  return {
    chapter: chapter.index,
    chapterTitle: chapter.title,
    actPhase: chapter.act,
    tensionTarget,
    pacingNote: pacingForPhase(chapter.act, chapter.tension, worldState.chapterTurnCount + 1),
    lengthGuide: LENGTH_BY_TENSION[tensionTarget] ?? '约 180-220 字',
    genreGuard: `严格保持「${outline.genre}」类型 —— 不得引入其他类型元素（如悬疑中突现灵异/科幻，或古装中出现现代事物）`,
    chapterGoal: chapter.goal,
    continuityKeys: extractContinuityKeys(worldState)
  }
}

/**
 * 判断是否应推进到下一章。
 * 规则：当前章节数超过预计轮数，或目标已达成。
 */
export function shouldAdvanceChapter(worldState: WorldState, outline: StoryOutline): boolean {
  const chapter = outline.chapters.find((c) => c.index === worldState.currentChapter)
  if (!chapter) return false
  if (worldState.chapterTurnCount >= chapter.estTurns) return true
  return false
}

/** 是否为最后一章 */
export function isLastChapter(worldState: WorldState, outline: StoryOutline): boolean {
  return worldState.currentChapter >= outline.chapters.length
}
