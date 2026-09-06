import type { PlayerProfile } from '@shared/types'
import { INTRO_QUESTIONS, type IntroOption } from '../data/introQuestions'

export { INTRO_QUESTIONS }
export type { IntroOption, IntroQuestion } from '../data/introQuestions'

/**
 * 由玩家在开场测试中的选择，聚合推断出玩家画像。
 * 纯计算，不调用 LLM。
 *
 * 维度（-5 ~ +5）：
 *  riskTolerance  冒险/安稳
 *  tone           明亮/暗黑
 *  pace           快节奏/慢热
 *  heart          重情/重理
 */
export function deriveProfile(answers: Record<string, number>): PlayerProfile {
  let risk = 0
  let tone = 0
  let pace = 0
  let heart = 0
  const genreCount: Record<string, number> = {}

  for (const q of INTRO_QUESTIONS) {
    const optionIdx = answers[q.id]
    if (optionIdx === undefined) continue
    const opt = q.options[optionIdx]
    if (!opt) continue
    const s = opt.scores
    risk += s.risk ?? 0
    tone += s.tone ?? 0
    pace += s.pace ?? 0
    heart += s.heart ?? 0
    for (const g of s.genres ?? []) {
      genreCount[g] = (genreCount[g] ?? 0) + 1
    }
  }

  // 归一化到 -5 ~ +5
  const clamp = (n: number): number => Math.max(-5, Math.min(5, n))

  // 选出最偏好的题材
  const genrePreference =
    Object.entries(genreCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '奇幻冒险'

  const profile: PlayerProfile = {
    riskTolerance: clamp(risk),
    tone: clamp(tone),
    pace: clamp(pace),
    heart: clamp(heart),
    genrePreference,
    summary: summarize(risk, tone, pace, heart, genrePreference)
  }
  return profile
}

function summarize(r: number, t: number, p: number, h: number, genre: string): string {
  const parts: string[] = []
  parts.push(r >= 1 ? '敢闯敢拼' : r <= -1 ? '步步为营' : '张弛有度')
  parts.push(t >= 1 ? '向光而生' : t <= -1 ? '偏爱幽深' : '明暗相生')
  parts.push(p >= 1 ? '雷厉风行' : p <= -1 ? '娓娓道来' : '不徐不疾')
  parts.push(h >= 1 ? '重情重义' : h <= -1 ? '冷静理性' : '情理并重')
  parts.push(`偏爱${genre}`)
  return parts.join('，')
}
