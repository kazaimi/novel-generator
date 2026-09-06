/**
 * 端到端游戏循环测试。
 * 加载编译后的真实主进程 bundle，直接调用 IPC handler，
 * 模拟玩家完整游玩：开场 → 多轮剧情 → 章节推进。
 */
const mod = require('./_e2e.cjs')
mod.registerIpcHandlers({})
const h = globalThis.__handlers
const events = globalThis.__events

function statuses() {
  return events.filter((e) => e.type === 'status').map((e) => e.message)
}

;(async () => {
  console.log('=== [1] 题库 ===')
  const qs = await h['intro:questions']()
  console.log(`✓ ${qs.length} 道题`)

  console.log('\n=== [2] 开场: 画像+蓝图 ===')
  const answers = { knock: 1, neverlose: 0, fear: 1, road: 0, gift: 2, dawn: 0 }
  const t0 = Date.now()
  const save = await h['intro:start']({}, answers)
  console.log(`✓ 耗时 ${((Date.now() - t0) / 1000).toFixed(1)}s`)
  console.log(`  题材: ${save.storyOutline.genre}`)
  console.log(`  画像: ${save.playerProfile.summary}`)
  save.storyOutline.chapters.forEach((c) =>
    console.log(`  第${c.index}章《${c.title}》 [${c.act}] tension=${c.tension} est=${c.estTurns}轮`)
  )

  console.log('\n=== [3] 游玩 8 轮(随机选选项) ===')
  let chosenId = null
  let okTurns = 0
  let failTurns = 0
  const chapterTrack = []

  for (let i = 0; i < 12 && !save.finished; i++) {
    const t1 = Date.now()
    const result = await h['generate:next']({}, save, chosenId)
    const dur = ((Date.now() - t1) / 1000).toFixed(1)
    if (!result) {
      failTurns++
      console.log(`✗ 第${i + 1}轮失败 (${dur}s) 最后事件:`, JSON.stringify(events[events.length - 1]))
      break
    }
    const turn = result.turn
    // 采纳主进程推进后的存档
    Object.assign(save, result.save)
    okTurns++
    chapterTrack.push(save.worldState.currentChapter)
    events.length = 0
    console.log(
      `✓ 第${i + 1}轮 [第${save.worldState.currentChapter}章] ${turn.narrative.length}字 (${dur}s)`
    )
    console.log(`   正文: ${turn.narrative.slice(0, 60)}…`)
    console.log(`   选项: ${turn.choices.map((c) => c.text).join(' / ')}`)
    chosenId = turn.choices[Math.floor(Math.random() * turn.choices.length)].id
  }
  console.log(`\n章节轨迹: ${chapterTrack.join('→')} (共推进到第 ${save.worldState.currentChapter} 章)`)
  console.log(`成功率: ${okTurns}/${okTurns + failTurns}`)
  console.log(`摘要长度: ${save.summary.length}字 | 历程: ${save.rawHistory.length}轮 | 物品: ${save.worldState.inventory.join('、') || '无'}`)

  console.log('\n=== [4] 主动完结 → 成书 ===')
  save.finished = true
  const t2 = Date.now()
  const novelResult = await h['novel:generate']({}, save)
  const dur2 = ((Date.now() - t2) / 1000).toFixed(1)
  if (novelResult.ok) {
    const n = novelResult.novel
    console.log(`✓ 《${n.title}》 ${n.author} 著 (${dur2}s)`)
    console.log(`  序言 ${n.preface.length}字: ${n.preface.slice(0, 50)}…`)
    n.chapters.forEach((c) => console.log(`  - ${c.heading} (${c.content.length}字)`))
    console.log(`  尾声 ${n.epilogue.length}字`)
  } else {
    console.log(`✗ 成书失败 (${dur2}s):`, novelResult.error)
  }

  console.log('\n=== 完成 ===')
  process.exit(0)
})().catch((e) => {
  console.error('E2E 异常:', e)
  process.exit(1)
})
