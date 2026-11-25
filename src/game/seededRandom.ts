/** FNV-1a, unsigned, never zero so mulberry32 has a real seed. */
export function hashSeed(input: string): number {
  let hash = 2166136261
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  const out = hash >>> 0
  return out === 0 ? 1 : out
}

/**
 * Mulberry32 step. `state` is the generator state; `value` is in [0, 1).
 * The same seed always yields the same stream.
 */
export function nextRandom(seed: number): { value: number; state: number } {
  let state = seed >>> 0
  state = (state + 0x6d2b79f5) | 0
  let t = Math.imul(state ^ (state >>> 15), 1 | state)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296
  return { value, state: state >>> 0 }
}

export function shuffle<T>(list: readonly T[], seed: number): { items: T[]; rng: number } {
  const items = list.slice()
  let rng = seed >>> 0
  for (let i = items.length - 1; i > 0; i--) {
    const roll = nextRandom(rng)
    rng = roll.state
    const j = Math.floor(roll.value * (i + 1))
    const swap = items[i]
    items[i] = items[j] as T
    items[j] = swap as T
  }
  return { items, rng }
}

export function todayString(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function shiftDate(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(year ?? 2026, (month ?? 1) - 1, day ?? 1)
  date.setDate(date.getDate() + days)
  return todayString(date)
}

/** Day 1 is 2026-01-01. The same calendar date is Hexora Daily #N everywhere. */
export function dailyNumber(iso: string): number {
  const epoch = Date.UTC(2026, 0, 1)
  const [year, month, day] = iso.split('-').map(Number)
  const stamp = Date.UTC(year ?? 2026, (month ?? 1) - 1, day ?? 1)
  return Math.round((stamp - epoch) / 86_400_000) + 1
}
