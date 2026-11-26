import type { Biome } from './types'
import type { PlacementEffects } from './engine'

const PENTA = {
  D3: 146.83,
  A3: 220,
  D4: 293.66,
  F4: 349.23,
  G4: 392,
  A4: 440,
  C5: 523.25,
  D5: 587.33,
  G5: 783.99,
} as const

const CHORDS: Record<Biome, number[]> = {
  water: [PENTA.D4, PENTA.A4, PENTA.D5],
  forest: [PENTA.F4, PENTA.C5, PENTA.D5],
  meadow: [PENTA.G4, PENTA.D5, PENTA.G5],
  mountain: [PENTA.A3, PENTA.D4, PENTA.A4],
  fauna: [PENTA.C5, PENTA.G5, PENTA.D5],
}

/**
 * A tiny in-browser synthesizer. Every tone is a D-minor pentatonic voice
 * shaped with a low-pass filter and a short delay. No samples are loaded.
 */
class HexoraAudio {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  muted = false

  setMuted(muted: boolean): void {
    this.muted = muted
    if (!this.master || !this.ctx) return
    const now = this.ctx.currentTime
    this.master.gain.cancelScheduledValues(now)
    this.master.gain.linearRampToValueAtTime(muted ? 0 : 0.45, now + 0.04)
  }

  unlock(): void {
    const ctx = this.ensure()
    if (ctx?.state === 'suspended') void ctx.resume()
  }

  playFor(biome: Biome, effects: PlacementEffects): void {
    if (effects.sound === 'alert') this.playAlert(biome)
    else this.playBiome(biome)
    if (effects.golden && effects.gained > 0) this.playGolden()
    if (effects.milestone) this.playMilestone()
  }

  playRestore(): void {
    this.playNotes([PENTA.G4, PENTA.C5, PENTA.D5], 0.7, 0.07)
  }

  playDeny(): void {
    this.playNotes([PENTA.A3], 0.12, 0.04, 'triangle')
  }

  private playBiome(biome: Biome): void {
    this.playNotes(CHORDS[biome], 0.9, biome === 'mountain' ? 0.06 : 0.075)
    if (biome === 'water') this.drip()
    else if (biome === 'forest') this.breeze()
    else if (biome === 'fauna') this.fireflies()
    else if (biome === 'mountain') this.thump()
  }

  private playAlert(biome: Biome): void {
    this.playNotes([PENTA.D4, PENTA.F4, PENTA.C5], 0.55, 0.05)
    this.playNotes([CHORDS[biome][0]!], 0.35, 0.03)
  }

  private playGolden(): void {
    const ctx = this.ready()
    if (!ctx || !this.master) return
    const notes = [PENTA.D5, PENTA.G5, 880, 1174.66]
    notes.forEach((freq, index) => {
      this.voice(ctx, freq, ctx.currentTime + index * 0.045, 0.26, 'sine', 0.045, this.master!)
    })
  }

  private playMilestone(): void {
    const ctx = this.ready()
    if (!ctx || !this.master) return
    const notes = [PENTA.D4, PENTA.F4, PENTA.A4, PENTA.C5, PENTA.D5]
    notes.forEach((freq, index) => {
      this.voice(ctx, freq, ctx.currentTime + 0.08 * index, 0.55, 'sine', 0.05, this.master!)
    })
  }

  private playNotes(freqs: number[], duration: number, gain: number, type: OscillatorType = 'sine'): void {
    const ctx = this.ready()
    if (!ctx || !this.master) return
    const now = ctx.currentTime
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(720, now)
    filter.frequency.exponentialRampToValueAtTime(1800, now + 0.06)
    filter.frequency.exponentialRampToValueAtTime(640, now + duration)
    filter.Q.value = 0.6
    filter.connect(this.master)
    for (const freq of freqs) this.voice(ctx, freq, now, duration, type, gain, filter)
  }

  private voice(
    ctx: AudioContext,
    freq: number,
    when: number,
    duration: number,
    type: OscillatorType,
    gain: number,
    dest: AudioNode,
  ): void {
    const osc = ctx.createOscillator()
    const amp = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, when)
    amp.gain.setValueAtTime(0.0001, when)
    amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), when + 0.035)
    amp.gain.exponentialRampToValueAtTime(0.0001, when + duration)
    osc.connect(amp)
    amp.connect(dest)
    osc.start(when)
    osc.stop(when + duration + 0.03)
  }

  private drip(): void {
    const ctx = this.ready()
    if (!ctx || !this.master) return
    const osc = ctx.createOscillator()
    const amp = ctx.createGain()
    const now = ctx.currentTime
    osc.type = 'sine'
    osc.frequency.setValueAtTime(1600, now)
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.22)
    amp.gain.setValueAtTime(0.0001, now)
    amp.gain.exponentialRampToValueAtTime(0.05, now + 0.015)
    amp.gain.exponentialRampToValueAtTime(0.0001, now + 0.28)
    osc.connect(amp)
    amp.connect(this.master)
    osc.start(now)
    osc.stop(now + 0.3)
  }

  private breeze(): void {
    const ctx = this.ready()
    if (!ctx || !this.master) return
    const source = ctx.createBufferSource()
    source.buffer = this.noise(ctx, 0.4)
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 900
    const amp = ctx.createGain()
    const now = ctx.currentTime
    amp.gain.setValueAtTime(0.0001, now)
    amp.gain.exponentialRampToValueAtTime(0.04, now + 0.08)
    amp.gain.exponentialRampToValueAtTime(0.0001, now + 0.45)
    source.connect(filter)
    filter.connect(amp)
    amp.connect(this.master)
    source.start(now)
    source.stop(now + 0.46)
  }

  private fireflies(): void {
    const ctx = this.ready()
    if (!ctx || !this.master) return
    ;[PENTA.G5, PENTA.D5].forEach((freq, index) => {
      this.voice(ctx, freq, ctx.currentTime + index * 0.07, 0.22, 'sine', 0.035, this.master!)
    })
  }

  private thump(): void {
    const ctx = this.ready()
    if (!ctx || !this.master) return
    const osc = ctx.createOscillator()
    const amp = ctx.createGain()
    const now = ctx.currentTime
    osc.type = 'sine'
    osc.frequency.setValueAtTime(120, now)
    osc.frequency.exponentialRampToValueAtTime(58, now + 0.22)
    amp.gain.setValueAtTime(0.0001, now)
    amp.gain.exponentialRampToValueAtTime(0.09, now + 0.02)
    amp.gain.exponentialRampToValueAtTime(0.0001, now + 0.28)
    osc.connect(amp)
    amp.connect(this.master)
    osc.start(now)
    osc.stop(now + 0.3)
  }

  private noise(ctx: AudioContext, seconds: number): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * seconds)
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    let last = 0
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1
      last = (last + 0.02 * white) / 1.02
      data[i] = last * 3.4
    }
    return buffer
  }

  private ready(): AudioContext | null {
    if (this.muted) return null
    const ctx = this.ensure()
    if (!ctx) return null
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  }

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return null
    const ctx = new Ctx()
    const master = ctx.createGain()
    master.gain.value = this.muted ? 0 : 0.45

    const delay = ctx.createDelay()
    delay.delayTime.value = 0.21
    const feedback = ctx.createGain()
    feedback.gain.value = 0.2
    const wet = ctx.createGain()
    wet.gain.value = 0.22
    master.connect(delay)
    delay.connect(feedback)
    feedback.connect(delay)
    delay.connect(wet)
    wet.connect(ctx.destination)
    master.connect(ctx.destination)

    const wind = ctx.createGain()
    wind.gain.value = 0.018
    const source = ctx.createBufferSource()
    source.buffer = this.noise(ctx, 2)
    source.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 640
    source.connect(filter)
    filter.connect(wind)
    wind.connect(master)
    source.start()

    this.ctx = ctx
    this.master = master
    return ctx
  }
}

export const audio = new HexoraAudio()

function listenForUnlock(): void {
  if (typeof window === 'undefined') return
  const resume = () => {
    audio.unlock()
  }
  window.addEventListener('pointerdown', resume, { capture: true, passive: true })
  window.addEventListener('touchstart', resume, { capture: true, passive: true })
}

listenForUnlock()
