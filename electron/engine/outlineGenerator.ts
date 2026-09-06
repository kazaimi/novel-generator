import type { PlayerProfile, StoryOutline } from '@shared/types'
import { AIClient } from '../ai/client'
import type { ChatMessage } from '../ai/client'
import { parseLooseJson } from '../ai/parser'

/**
 * 生成剧情蓝图（StoryOutline）。
 *
 * 开场测试得出玩家画像后，调用一次 LLM，生成：
 *  - 锁定的题材类型
 *  - 核心设定 / 前提
 *  - 世界观
 *  - 5 个章节（启承转合 + 情绪曲线）
 *
 * 仅开场调用 1 次，之后持久化在存档中。
 */

const OUTLINE_SCHEMA = {
  type: 'object',
  properties: {
    genre: { type: 'string' },
    premise: { type: 'string' },
    world_setting: { type: 'string' },
    chapters: {
      type: 'array',
      minItems: 5,
      maxItems: 5,
      items: {
        type: 'object',
        properties: {
          index: { type: 'number' },
          title: { type: 'string' },
          act: { type: 'string', enum: ['起', '承', '转', '合'] },
          tension: { type: 'number' },
          goal: { type: 'string' },
          est_turns: { type: 'number' }
        },
        required: ['index', 'title', 'act', 'tension', 'goal']
      }
    }
  },
  required: ['genre', 'premise', 'world_setting', 'chapters']
}

function profileToText(p: PlayerProfile): string {
  const dirs: string[] = []
  dirs.push(`冒险倾向 ${p.riskTolerance >= 0 ? '+' : ''}${p.riskTolerance}`)
  dirs.push(`色调 ${p.tone >= 0 ? '+' : ''}${p.tone}（+明亮 / -暗黑）`)
  dirs.push(`节奏 ${p.pace >= 0 ? '+' : ''}${p.pace}（+快 / -慢）`)
  dirs.push(`重情重理 ${p.heart >= 0 ? '+' : ''}${p.heart}（+重情 / -重理）`)
  dirs.push(`题材偏好：${p.genrePreference}`)
  dirs.push(`画像：${p.summary}`)
  return dirs.join('；')
}

function buildMessages(profile: PlayerProfile): ChatMessage[] {
  const system = [
    '你是一位顶尖的小说策划。请基于玩家的「心理画像」，为其量身定制一部互动小说的剧情蓝图。',
    '',
    '【玩家画像】',
    profileToText(profile),
    '',
    '【要求】',
    '1. genre：锁定一个明确题材（基于画像偏好，如 奇幻冒险 / 悬疑推理 / 科幻 / 言情治愈 / 古装宫廷）。一旦锁定，全剧不得类型漂移。',
    '2. premise：一句话核心设定，要有钩子。',
    '3. world_setting：100-150 字的世界观，奠定氛围基调（明/暗、节奏依画像而定）。',
    '4. chapters：恰好 5 章，遵循「启承转合」结构：',
    '   - 第1章 act="起"，tension 1-2，介绍主角与世界观',
    '   - 第2章 act="承"，tension 2-3，铺垫发展',
    '   - 第3章 act="承"，tension 3-4，矛盾深化',
    '   - 第4章 act="转"，tension 5，高潮与反转',
    '   - 第5章 act="合"，tension 2，收束与结局',
    '   每章给出 title、goal（本章核心目标）、est_turns（预计轮数 3-6）。',
    '5. tension 为 1-5 的整数。',
    '',
    '返回 JSON。'
  ].join('\n')

  return [
    { role: 'system', content: system } as ChatMessage,
    { role: 'user', content: '请生成蓝图。' } as ChatMessage
  ]
}

/** 把 LLM 返回的对象规范化为 StoryOutline */
function normalize(raw: unknown): StoryOutline | null {
  if (!raw || typeof raw !== 'object') return null
  let obj = raw as Record<string, unknown>
  // 智谱等平台可能把结果包在 {"answer": {...}} 或 {"data": {...}} 里，需解包
  if (!Array.isArray(obj.chapters)) {
    const inner = (obj.answer ?? obj.data ?? obj.result) as Record<string, unknown> | undefined
    if (inner && typeof inner === 'object' && Array.isArray(inner.chapters)) {
      obj = inner
    }
  }
  const chaptersRaw = Array.isArray(obj.chapters) ? (obj.chapters as unknown[]) : []
  const chapters = chaptersRaw
    .map((c, i): import('@shared/types').OutlineChapter | null => {
      if (!c || typeof c !== 'object') return null
      const o = c as Record<string, unknown>
      const act = o.act
      return {
        index: typeof o.index === 'number' ? o.index : i + 1,
        title: typeof o.title === 'string' ? o.title : `第${i + 1}章`,
        act: act === '起' || act === '承' || act === '转' || act === '合' ? act : '起',
        tension: Math.max(1, Math.min(5, typeof o.tension === 'number' ? o.tension : 3)),
        goal: typeof o.goal === 'string' ? o.goal : '',
        estTurns: typeof o.est_turns === 'number' ? o.est_turns : 4
      }
    })
    .filter((c): c is import('@shared/types').OutlineChapter => c !== null)

  if (chapters.length === 0) return null

  return {
    genre: typeof obj.genre === 'string' ? obj.genre : '奇幻冒险',
    premise: typeof obj.premise === 'string' ? obj.premise : '',
    worldSetting:
      typeof obj.world_setting === 'string'
        ? obj.world_setting
        : typeof obj.worldSetting === 'string'
          ? obj.worldSetting
          : '',
    chapters
  }
}

/** 生成蓝图（含流式状态回调） */
export async function generateOutline(
  profile: PlayerProfile,
  onStatus?: (msg: string) => void
): Promise<StoryOutline> {
  const client = new AIClient()
  const text = await client.generate(buildMessages(profile), {
    stream: false, // 蓝图一次性生成，无需打字机
    jsonSchema: OUTLINE_SCHEMA,
    jsonObject: true,
    temperature: 0.9,
    onStatus
  })
  const parsed = parseLooseJson(text)
  const outline = normalize(parsed)
  if (!outline) {
    console.error('[outline] normalize 失败, 原始返回前200字:', text.slice(0, 200))
    throw new Error('蓝图生成失败，请重试')
  }
  return outline
}
