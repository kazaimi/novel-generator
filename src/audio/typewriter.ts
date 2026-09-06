/**
 * 打字机音效 —— 用 Web Audio API 合成短促"咔嗒"声。
 * 无需任何音频文件，体积小，可开关。
 *
 * 原理：每次播放一个极短的白噪音脉冲 + 快速衰减包络，
 * 模拟老式打字机按键敲击的清脆质感。
 */
class TypewriterSound {
  private ctx: AudioContext | null = null
  private enabled = true

  setEnabled(v: boolean): void {
    this.enabled = v
  }

  /** 延迟初始化 AudioContext（需在用户交互后） */
  private ensureCtx(): AudioContext | null {
    if (typeof window === 'undefined') return null
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!AC) return null
      this.ctx = new AC()
    }
    // 浏览器可能挂起 context，需恢复
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume()
    }
    return this.ctx
  }

  /** 用户首次交互时调用，解锁音频 */
  unlock(): void {
    this.ensureCtx()
  }

  /** 播放一次咔嗒声 */
  click(): void {
    if (!this.enabled) return
    const ctx = this.ensureCtx()
    if (!ctx) return

    const now = ctx.currentTime

    // 白噪音缓冲（极短，模拟击键瞬态）
    const bufferSize = Math.floor(ctx.sampleRate * 0.04) // 40ms
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      // 前段陡降的白噪音
      const decay = Math.pow(1 - i / bufferSize, 3)
      data[i] = (Math.random() * 2 - 1) * decay
    }

    const noise = ctx.createBufferSource()
    noise.buffer = buffer

    // 带通滤波，让声音集中在清脆的频段
    const bandpass = ctx.createBiquadFilter()
    bandpass.type = 'bandpass'
    bandpass.frequency.value = 1800 + Math.random() * 600 // 轻微随机，更自然
    bandpass.Q.value = 0.8

    // 增益包络
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.18, now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05)

    noise.connect(bandpass)
    bandpass.connect(gain)
    gain.connect(ctx.destination)

    noise.start(now)
    noise.stop(now + 0.05)
  }
}

export const typewriterSound = new TypewriterSound()
