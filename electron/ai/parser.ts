/**
 * 增量提取：从「尚未生成完毕」的 JSON 文本中提取 narrative 字段的当前值。
 *
 * 用于流式显示——模型边生成边调用，每次返回 narrative 目前已写出的部分。
 * 实现要点：
 *  - 兼容 {"answer":{"narrative":...}} 等包裹（找第一个 narrative 键即可）
 *  - 正确处理转义（\" \\ \n \uXXXX），残缺的 \u 转义截断丢弃
 *  - 字符串未闭合时返回目前已写出的部分（流式尾部）
 */
export function extractNarrativeSoFar(buffer: string): string {
  if (!buffer) return ''
  // 找到 narrative 键（允许任意缩进/换行），定位其值的起始引号
  const keyMatch = /"narrative"\s*:\s*"/.exec(buffer)
  if (!keyMatch) return ''
  const start = keyMatch.index + keyMatch[0].length

  let out = ''
  let i = start
  while (i < buffer.length) {
    const ch = buffer[i]
    if (ch === '"') {
      // 未转义的闭合引号 → narrative 完整结束
      break
    }
    if (ch === '\\') {
      const next = buffer[i + 1]
      if (next === undefined) break // 流式尾部残缺转义
      switch (next) {
        case '"':
          out += '"'
          break
        case '\\':
          out += '\\'
          break
        case '/':
          out += '/'
          break
        case 'n':
          out += '\n'
          break
        case 't':
          out += '\t'
          break
        case 'r':
          break
        case 'u': {
          const hex = buffer.slice(i + 2, i + 6)
          if (hex.length < 4 || !/^[0-9a-fA-F]+$/.test(hex)) {
            // \u 转义不完整（流式尾部）——丢弃并结束
            return out
          }
          out += String.fromCharCode(parseInt(hex, 16))
          i += 4 // 循环末尾 +1，共跳过 \uXXXX
          break
        }
        default:
          // 未知转义，原样保留
          out += next
      }
      i += 2
      continue
    }
    out += ch
    i += 1
  }
  return out
}

/**
 * JSON 三层降级解析器。
 *
 * 免费模型的输出不一定能严格符合 JSON 格式，需要多重容错：
 * 1. 直接 JSON.parse
 * 2. 正则提取 {...} 块后再 parse（处理 markdown 包裹、前后多余文字）
 * 3. 截断修复尝试（补全缺失的括号）
 */
export function parseLooseJson(text: string): unknown | null {
  if (!text) return null

  // 第 1 层：直接解析
  try {
    return JSON.parse(text)
  } catch {
    // 继续
  }

  const trimmed = text.trim()

  // 第 2 层：正则提取最外层 { ... } 块
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) {
    const slice = trimmed.slice(start, end + 1)
    try {
      return JSON.parse(slice)
    } catch {
      // 继续
    }
  }

  // 第 3 层：截断修复 —— 去除可能的尾随逗号，补全缺失括号
  if (start !== -1) {
    let slice = trimmed.slice(start)
    // 去除 markdown 代码块标记
    slice = slice.replace(/```json|```/g, '').trim()
    // 去除尾随逗号
    slice = slice.replace(/,\s*([}\]])/g, '$1')
    // 统计未闭合的括号
    const fixed = repairBrackets(slice)
    try {
      return JSON.parse(fixed)
    } catch {
      // 继续
    }
  }

  return null
}

/** 通过统计括号深度，补全缺失的闭合括号 */
function repairBrackets(s: string): string {
  const stack: string[] = []
  let inString = false
  let escape = false
  for (const ch of s) {
    if (escape) {
      escape = false
      continue
    }
    if (ch === '\\') {
      escape = true
      continue
    }
    if (ch === '"') {
      inString = !inString
      continue
    }
    if (inString) continue
    if (ch === '{' || ch === '[') stack.push(ch)
    else if (ch === '}' && stack[stack.length - 1] === '{') stack.pop()
    else if (ch === ']' && stack[stack.length - 1] === '[') stack.pop()
  }
  // 如果还在字符串里，先闭合字符串
  let repaired = s
  if (inString) repaired += '"'
  // 反向补全括号
  for (let i = stack.length - 1; i >= 0; i--) {
    repaired += stack[i] === '{' ? '}' : ']'
  }
  return repaired
}
