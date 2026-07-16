class AudioManager {
  private context: AudioContext | null = null
  muted = true

  setMuted(value: boolean) { this.muted = value }
  unlock() {
    if (!this.context) this.context = new AudioContext()
    if (this.context.state === 'suspended') void this.context.resume()
  }
  play(kind: 'tap' | 'score' | 'perfect' | 'fail') {
    if (this.muted) return
    this.unlock(); if (!this.context) return
    const now = this.context.currentTime
    const gain = this.context.createGain(); gain.connect(this.context.destination); gain.gain.setValueAtTime(.0001, now)
    gain.gain.exponentialRampToValueAtTime(kind === 'fail' ? .08 : .055, now + .008); gain.gain.exponentialRampToValueAtTime(.0001, now + (kind === 'perfect' ? .45 : .2))
    const oscillator = this.context.createOscillator(); oscillator.connect(gain)
    oscillator.type = kind === 'fail' ? 'sawtooth' : kind === 'tap' ? 'triangle' : 'sine'
    const start = { tap: 210, score: 520, perfect: 660, fail: 150 }[kind]; oscillator.frequency.setValueAtTime(start, now)
    oscillator.frequency.exponentialRampToValueAtTime(kind === 'fail' ? 70 : start * 1.65, now + .18); oscillator.start(now); oscillator.stop(now + .5)
  }
}

export const audioManager = new AudioManager()
