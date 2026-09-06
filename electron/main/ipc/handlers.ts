import { ipcMain, BrowserWindow, dialog } from 'electron'
import { writeFile } from 'fs/promises'
import type { AppConfig, GeneratedNovel, PlayerProfile, StorySave, StoryTurn, StreamEvent } from '@shared/types'
import { getConfig, setConfig, listSaves, loadSave, putSave, deleteSave } from '../../store/config'
import { AIClient, AIError } from '../../ai/client'
import { parseLooseJson } from '../../ai/parser'
import { buildStoryMessages, normalizeTurn, STORY_TURN_SCHEMA } from '../../ai/promptBuilder'
import { deriveDirective } from '../../engine/director'
import { deriveProfile, INTRO_QUESTIONS } from '../../engine/profiler'
import { generateOutline } from '../../engine/outlineGenerator'
import { generateNovel } from '../../engine/novelGenerator'
import { applyTurnToSave } from '../../engine/memory'

/** 当前进行中的生成（用于取消） */
let cancelled = false

/** 把流事件推送给当前窗口 */
function emit(event: StreamEvent): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('generate:event', event)
  }
}

export function registerIpcHandlers(_ipc: typeof ipcMain): void {
  /* ---------- 配置 ---------- */
  ipcMain.handle('config:get', () => getConfig())
  ipcMain.handle('config:set', (_e, patch: Partial<AppConfig>) => setConfig(patch))

  /* ---------- 存档 ---------- */
  ipcMain.handle('save:list', () => listSaves())
  ipcMain.handle('save:load', (_e, id: string) => loadSave(id))
  ipcMain.handle('save:put', (_e, save: StorySave) => {
    putSave(save)
  })
  ipcMain.handle('save:delete', (_e, id: string) => deleteSave(id))

  /* ---------- AI 测试连接 ---------- */
  ipcMain.handle('ai:testConnection', async () => {
    try {
      const client = new AIClient()
      const enabledCount = client.getEnabledModels().length
      const text = await client.generate(
        [{ role: 'user', content: '回复OK' }],
        {
          stream: false,
          // 测试连接只试免费模型（不消耗付费余额）
          maxModelSwitches: enabledCount,
          retriesPerModel: 1,
          temperature: 0
        }
      )
      return { ok: true, message: '连接成功：' + text.slice(0, 30) }
    } catch (err) {
      return { ok: false, message: (err as Error).message }
    }
  })

  /* ---------- 开场：获取题库 ---------- */
  ipcMain.handle('intro:questions', () => INTRO_QUESTIONS)

  /* ---------- 开场：画像→蓝图→创建存档 ---------- */
  ipcMain.handle('intro:start', async (_e, answers: Record<string, number>) => {
    // 1. 推断画像（纯计算）
    const profile: PlayerProfile = deriveProfile(answers)
    // 2. 生成蓝图（1 次 LLM）
    const outline = await generateOutline(profile, (msg) =>
      emit({ type: 'status', message: msg })
    )
    // 3. 组装初始存档
    const now = new Date().toISOString()
    const save: StorySave = {
      id: `story-${Date.now()}`,
      title: outline.chapters[0]?.title ?? outline.genre,
      createdAt: now,
      updatedAt: now,
      playerProfile: profile,
      storyOutline: outline,
      worldState: {
        inventory: [],
        flags: {},
        npcs: {},
        currentChapter: 1,
        chapterTurnCount: 0
      },
      summary: '',
      rawHistory: [],
      recentTurns: [],
      finished: false
    }
    putSave(save)
    return save
  })

  /* ---------- 生成下一轮剧情（流式） ---------- */
  ipcMain.handle('generate:next', async (_e, save: StorySave, chosenId: string | null) => {
    cancelled = false
    try {
      const client = new AIClient()

      // 1. Director 推导导演指令（纯规则，不调 LLM）
      const directive = deriveDirective(save.storyOutline, save.worldState, save.playerProfile)

      // 2. 组装 prompt
      const messages = buildStoryMessages(save, chosenId, directive)

      // 3. 调用模型池（流式）
      const rawText = await client.generate(messages, {
        stream: true,
        jsonSchema: STORY_TURN_SCHEMA,
        jsonObject: true,
        temperature: 0.85,
        onToken: (delta: string) => {
          if (!cancelled) emit({ type: 'token', delta })
        },
        onStatus: (message: string) => {
          if (!cancelled) emit({ type: 'status', message })
        },
        shouldCancel: () => cancelled
      })

      if (cancelled) {
        emit({ type: 'done', turn: null })
        return null
      }

      // 4. 解析 JSON。若模型返回纯文本（不遵守JSON），追加强约束重试
      let parsed = parseLooseJson(rawText)
      let normalized = normalizeTurn(parsed)

      // JSON 修复重试：最多追加 2 次
      let fixRetry = 0
      let lastText = rawText
      while (!normalized && fixRetry < 2) {
        fixRetry++
        emit({ type: 'status', message: '正在规范输出格式…' })
        const fixedText = await client.generate(
          [
            ...messages,
            { role: 'assistant', content: lastText },
            {
              role: 'user',
              content:
                '你上一条回复不是JSON。请把你刚才生成的剧情重新输出为合法JSON，必须包含 narrative 和 choices(3个) 两个字段，只输出JSON，以 { 开头。'
            }
          ],
          {
            stream: true,
            jsonObject: true,
            temperature: 0.5,
            onToken: (delta: string) => {
              if (!cancelled) emit({ type: 'token', delta })
            }
          }
        )
        lastText = fixedText
        parsed = parseLooseJson(fixedText)
        normalized = normalizeTurn(parsed)
      }

      if (!normalized) {
        emit({ type: 'done', turn: null, error: '模型输出无法解析，请重试' })
        return null
      }

      const turn: StoryTurn = {
        narrative: normalized.narrative,
        choices: normalized.choices,
        stateDelta: normalized.stateDelta,
        profileDelta: normalized.profileDelta,
        chapterProgress: normalized.chapterProgress,
        isEnding: normalized.isEnding
      }

      // 5. 主进程统一推进存档状态（历程/摘要/世界状态/章节）并持久化
      await applyTurnToSave(save, turn, chosenId)
      putSave(save)

      emit({ type: 'done', turn })
      return { turn, save }
    } catch (err) {
      const message = err instanceof AIError ? err.message : (err as Error).message
      emit({ type: 'done', turn: null, error: message })
      return null
    }
  })

  ipcMain.handle('generate:cancel', () => {
    cancelled = true
  })

  /* ---------- 完结生成小说 ---------- */
  ipcMain.handle('novel:generate', async (_e, save: StorySave) => {
    try {
      const novel = await generateNovel(save, (p) => {
        emit({ type: 'status', message: p.message })
        if (p.delta) {
          emit({ type: 'token', delta: p.delta })
        }
      })
      // 持久化到存档
      const updated = { ...save, novel, finished: true }
      putSave(updated)
      return { ok: true as const, novel }
    } catch (err) {
      return { ok: false as const, error: (err as Error).message }
    }
  })

  /* ---------- 导出小说 ---------- */
  ipcMain.handle('novel:export', async (_e, novel: GeneratedNovel, format: 'txt' | 'markdown') => {
    const ext = format === 'markdown' ? 'md' : 'txt'
    const safeTitle = novel.title.replace(/[\\/:*?"<>|]/g, '_')
    const res = await dialog.showSaveDialog({
      title: '导出小说',
      defaultPath: `${safeTitle}.${ext}`,
      filters: [
        { name: format === 'markdown' ? 'Markdown' : '文本文件', extensions: [ext] }
      ]
    })
    if (res.canceled || !res.filePath) {
      return { ok: false, error: '已取消' }
    }
    const content =
      format === 'markdown'
        ? renderMarkdown(novel)
        : renderTxt(novel)
    try {
      await writeFile(res.filePath, content, 'utf-8')
      return { ok: true, path: res.filePath }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  })
}

/** 渲染为 Markdown */
function renderMarkdown(n: GeneratedNovel): string {
  const lines: string[] = []
  lines.push(`# ${n.title}`)
  lines.push('')
  lines.push(`*作者：${n.author}*`)
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## 序')
  lines.push('')
  lines.push(n.preface)
  lines.push('')
  for (const ch of n.chapters) {
    lines.push(`## ${ch.heading}`)
    lines.push('')
    lines.push(ch.content)
    lines.push('')
  }
  lines.push('## 尾声')
  lines.push('')
  lines.push(n.epilogue)
  lines.push('')
  return lines.join('\n')
}

/** 渲染为纯文本 */
function renderTxt(n: GeneratedNovel): string {
  const lines: string[] = []
  lines.push(n.title)
  lines.push(`作者：${n.author}`)
  lines.push('')
  lines.push('【序】')
  lines.push(n.preface)
  lines.push('')
  for (const ch of n.chapters) {
    lines.push(ch.heading)
    lines.push('')
    lines.push(ch.content)
    lines.push('')
  }
  lines.push('【尾声】')
  lines.push(n.epilogue)
  return lines.join('\n')
}
