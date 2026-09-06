/**
 * 开场心理测试题库。
 *
 * 设计哲学：题目"看似无关"，但每个选项都暗中映射到玩家画像维度
 * （冒险/安稳、明/暗、快/慢、重情/重理、题材偏好）。
 * 玩家做的是有趣的小测试，却不知不觉塑造了自己的世界。
 */

export interface IntroOption {
  text: string
  /** 该选项对画像各维度的贡献 */
  scores: {
    risk?: number // 冒险 +
    tone?: number // 明亮 +
    pace?: number // 快 +
    heart?: number // 重情 +
    genres?: string[] // 倾向题材
  }
}

export interface IntroQuestion {
  id: string
  /** 情境题题干 */
  prompt: string
  /** 选项 */
  options: IntroOption[]
}

export const INTRO_QUESTIONS: IntroQuestion[] = [
  {
    id: 'knock',
    prompt: '深夜，雨敲着窗。忽然，门外传来三声不轻不重的叩门。你没有在等任何人。你的第一反应是——',
    options: [
      {
        text: '屏息凑近猫眼，看清来者再说',
        scores: { risk: -1, tone: -1, heart: -1, genres: ['悬疑'] }
      },
      {
        text: '一把拉开门，看看是谁',
        scores: { risk: 2, pace: 1, genres: ['冒险'] }
      },
      {
        text: '装作不在家，等敲门声自己消失',
        scores: { risk: -2, tone: -1, genres: ['悬疑', '言情'] }
      },
      {
        text: '隔着门问一声"是谁"，准备好最近的武器',
        scores: { risk: 0, heart: -1, genres: ['科幻', '悬疑'] }
      }
    ]
  },
  {
    id: 'neverlose',
    prompt: '如果可以拥有一样永远不会失去的东西，你会选择——',
    options: [
      { text: '一颗永不动摇的心', scores: { heart: 2, tone: 1, genres: ['言情'] } },
      { text: '一个永远解不完的谜', scores: { heart: -2, pace: 0, genres: ['悬疑'] } },
      { text: '一双能看见远方的眼睛', scores: { risk: 1, genres: ['冒险', '科幻'] } },
      { text: '一段永远不会被篡改的记忆', scores: { tone: -1, heart: 1, genres: ['悬疑', '科幻'] } }
    ]
  },
  {
    id: 'fear',
    prompt: '你更害怕哪一种？',
    options: [
      { text: '无尽的、没有回音的等待', scores: { pace: -2, tone: -1, genres: ['悬疑'] } },
      { text: '短暂而滚烫、注定熄灭的燃烧', scores: { pace: 2, tone: 1, heart: 1, genres: ['冒险', '言情'] } },
      { text: '发现自己一直是被操纵的棋子', scores: { heart: -1, genres: ['悬疑', '科幻'] } },
      { text: '一成不变、看到尽头的安稳', scores: { risk: 2, pace: 1, genres: ['冒险'] } }
    ]
  },
  {
    id: 'road',
    prompt: '面前有两条路。一条笔直通向远方，看得见尽头有光；一条蜿蜒没入密林，深处传来未知的声音。你走——',
    options: [
      { text: '笔直那条，我想要那束光', scores: { risk: -1, tone: 2, pace: 1, genres: ['言情', '冒险'] } },
      { text: '密林那条，未知才让我兴奋', scores: { risk: 2, tone: -1, genres: ['冒险', '悬疑'] } },
      { text: '先在岔路口坐一会，听听密林里到底是什么声音', scores: { risk: 0, heart: 1, genres: ['悬疑'] } },
      { text: '哪条都不走，我要自己蹚出第三条', scores: { risk: 2, heart: -1, genres: ['科幻', '冒险'] } }
    ]
  },
  {
    id: 'gift',
    prompt: '有人送你一件礼物，你拆开发现——它正好是你最不想被人知道的那样东西。你会——',
    options: [
      { text: '追问对方是怎么知道的', scores: { heart: -1, pace: 1, genres: ['悬疑'] } },
      { text: '不动声色收下，暗中观察对方', scores: { heart: -2, tone: -1, genres: ['悬疑', '科幻'] } },
      { text: '坦诚地告诉对方你的感受', scores: { heart: 2, tone: 1, genres: ['言情'] } },
      { text: '把它转送给真正需要它的人', scores: { heart: 1, tone: 2, genres: ['言情', '冒险'] } }
    ]
  },
  {
    id: 'dawn',
    prompt: '黎明前最暗的那一刻，你独自醒着。你在想——',
    options: [
      { text: '天快亮了，一切都会好起来', scores: { tone: 2, pace: 1, genres: ['言情', '冒险'] } },
      { text: '黑暗里藏着什么，我想看清它', scores: { tone: -2, genres: ['悬疑'] } },
      { text: '此刻的世界安静得刚刚好', scores: { pace: -1, tone: 1, genres: ['言情'] } },
      { text: '如果这一刻能无限延长，我愿留下', scores: { heart: 1, tone: -1, genres: ['科幻', '悬疑'] } }
    ]
  }
]
