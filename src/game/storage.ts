import { isAtlasId } from './atlas'
import { assessBiodiversity } from './engine'
import { shiftDate, todayString } from './seededRandom'
import { BOUNTY_LABEL, bountyById, type BountyId, type DailyRecord, type EndReason, type GameState, type Settings, type SkinName, type Stats } from './types'

const SAVE_KEY = 'hexora_save'
const STATS_KEY = 'hexora_stats'
const SETTINGS_KEY = 'hexora_settings'
const ATLAS_KEY = 'hexora_atlas'

export interface SaveFile {
  version: 1
  infinite: GameState | null
  daily: GameState | null
}

export const defaultSettings = (): Settings => ({
  muted: false,
  theme: 'day',
  skin: 'classic',
  hintSeen: false,
})

export const defaultStats = (): Stats => ({
  infiniteBest: 0,
  dailyBest: 0,
  dailyByDate: {},
  streak: 0,
  lastDailyDate: '',
})

export function emptySave(): SaveFile {
  return { version: 1, infinite: null, daily: null }
}

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Private mode and full storage should not stop the mosaic.
  }
}

function isSkin(value: unknown): value is SkinName {
  return value === 'classic' || value === 'kyoto' || value === 'reef'
}

function isBountyId(value: unknown): value is BountyId {
  return typeof value === 'string' && value in BOUNTY_LABEL
}

function knownIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((id): id is string => typeof id === 'string' && isAtlasId(id))
}

function normalizeGame(game: GameState): GameState {
  const bountyId = isBountyId(game.bounty?.id) ? game.bounty.id : 'river4'
  let endReason: EndReason | null = game.endReason === 'harmony' || game.endReason === 'seeds' ? game.endReason : null
  if (!game.gameOver) endReason = null
  else if (!endReason) endReason = 'harmony'
  return {
    ...game,
    revived: game.revived === true,
    seeds: typeof game.seeds === 'number' && Number.isFinite(game.seeds) ? game.seeds : game.mode === 'infinite' ? 25 : 0,
    goldenFlow: game.goldenFlow === true,
    goldenReady: game.goldenReady === true,
    bounty: bountyById(bountyId),
    discoveries: knownIds(game.discoveries),
    freshDiscoveries: knownIds(game.freshDiscoveries),
    endReason,
  }
}

export function loadAtlas(): string[] {
  return knownIds(readJson(ATLAS_KEY))
}

export function writeAtlas(ids: readonly string[]): void {
  writeJson(ATLAS_KEY, [...new Set(ids.filter(isAtlasId))])
}

function isGame(value: unknown): value is GameState {
  if (!value || typeof value !== 'object') return false
  const game = value as GameState
  return (
    (game.mode === 'infinite' || game.mode === 'daily') &&
    Array.isArray(game.tiles) &&
    Array.isArray(game.deck) &&
    typeof game.score === 'number' &&
    typeof game.harmony === 'number' &&
    typeof game.index === 'number'
  )
}

export function loadSave(): SaveFile {
  const parsed = readJson(SAVE_KEY) as Partial<SaveFile> | null
  if (!parsed || parsed.version !== 1) return emptySave()
  return {
    version: 1,
    infinite: isGame(parsed.infinite) ? normalizeGame(parsed.infinite) : null,
    daily: isGame(parsed.daily) ? normalizeGame(parsed.daily) : null,
  }
}

export function writeSave(save: SaveFile): void {
  writeJson(SAVE_KEY, save)
}

export function loadSettings(): Settings {
  const parsed = readJson(SETTINGS_KEY) as Partial<Settings> | null
  const base = defaultSettings()
  if (!parsed) return base
  return {
    muted: parsed.muted === true,
    theme: parsed.theme === 'night' ? 'night' : 'day',
    skin: isSkin(parsed.skin) ? parsed.skin : 'classic',
    hintSeen: parsed.hintSeen === true,
  }
}

export function writeSettings(settings: Settings): void {
  writeJson(SETTINGS_KEY, settings)
}

export function loadStats(): Stats {
  const parsed = readJson(STATS_KEY) as Partial<Stats> | null
  const base = defaultStats()
  if (!parsed) return base
  const dailyByDate: Record<string, DailyRecord> = {}
  if (parsed.dailyByDate && typeof parsed.dailyByDate === 'object') {
    for (const [date, record] of Object.entries(parsed.dailyByDate)) {
      if (!record || typeof record.score !== 'number') continue
      dailyByDate[date] = {
        score: record.score,
        harmony: typeof record.harmony === 'number' ? record.harmony : 0,
        grade: typeof record.grade === 'string' ? record.grade : 'D',
        label: typeof record.label === 'string' ? record.label : 'Monoculture',
      }
    }
  }
  return {
    infiniteBest: typeof parsed.infiniteBest === 'number' ? parsed.infiniteBest : 0,
    dailyBest: typeof parsed.dailyBest === 'number' ? parsed.dailyBest : 0,
    dailyByDate,
    streak: typeof parsed.streak === 'number' ? parsed.streak : 0,
    lastDailyDate: typeof parsed.lastDailyDate === 'string' ? parsed.lastDailyDate : '',
  }
}

export function writeStats(stats: Stats): void {
  writeJson(STATS_KEY, stats)
}

export function visibleStreak(stats: Stats, today = todayString()): number {
  if (!stats.lastDailyDate) return 0
  if (stats.lastDailyDate === today || stats.lastDailyDate === shiftDate(today, -1)) return stats.streak
  return 0
}

export function applyStats(stats: Stats, game: GameState): Stats {
  let next: Stats | null = null
  const edit = (): Stats => {
    if (!next) next = { ...stats, dailyByDate: { ...stats.dailyByDate } }
    return next
  }

  if (game.mode === 'infinite' && game.score > stats.infiniteBest) edit().infiniteBest = game.score

  if (game.mode === 'daily' && game.date) {
    const bio = assessBiodiversity(game.tiles)
    const previous = stats.dailyByDate[game.date]
    if (!previous || game.score > previous.score) {
      edit().dailyByDate[game.date] = {
        score: game.score,
        harmony: Math.round(game.harmony),
        grade: bio.grade,
        label: bio.label,
      }
    }
    const best = Math.max(stats.dailyBest, game.score)
    if (best > stats.dailyBest) edit().dailyBest = best
    if ((game.gameOver || game.victory) && stats.lastDailyDate !== game.date) {
      const drafted = edit()
      drafted.streak = stats.lastDailyDate === shiftDate(game.date, -1) ? stats.streak + 1 : 1
      drafted.lastDailyDate = game.date
    }
  }

  return next ?? stats
}
