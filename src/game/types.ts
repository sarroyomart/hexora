export type Biome = 'water' | 'forest' | 'meadow' | 'mountain' | 'fauna'

export type TileKind = Biome | 'core'

export type TileCondition =
  | 'normal'
  | 'river'
  | 'swamp'
  | 'drought'
  | 'fertileAsh'
  | 'crater'

export type GameMode = 'infinite' | 'daily'

export type ThemeName = 'day' | 'night'

export type SkinName = 'classic' | 'kyoto' | 'reef'

export interface Tile {
  q: number
  r: number
  kind: TileKind
  condition: TileCondition
  vitality: number
  placedTurn: number
}

export interface DroughtCluster {
  keys: string[]
  resolveOnTurn: number
}

export interface GameState {
  mode: GameMode
  date: string
  dailyNumber: number
  tiles: Tile[]
  deck: Biome[]
  bag: Biome[]
  index: number
  rngState: number
  score: number
  harmony: number
  turn: number
  placedCount: number
  wildcards: number
  milestonesClaimed: number
  season: number
  droughts: DroughtCluster[]
  gameOver: boolean
  victory: boolean
  /** True after the once-per-run rewarded continue has been spent. */
  revived: boolean
  /** Why a lost run ended. Null while the mosaic is still alive. */
  endReason: EndReason | null
  /** Tiles left to place in Zen. Daily runs ignore this purse. */
  seeds: number
  /** 2× score while a clean synergy streak holds after lighting at full harmony. */
  goldenFlow: boolean
  /** One clean synergy at 100% harmony has landed; the next one lights Golden Flow. */
  goldenReady: boolean
  bounty: Bounty
  /** Formation ids seen on this run, including ones already in the Atlas. */
  discoveries: string[]
  /** Formation ids unlocked for the first time during this run. */
  freshDiscoveries: string[]
  log: string
}

export interface BiomeInfo {
  name: string
  epithet: string
  emoji: string
  /** Light face, deep face, ink for symbols. */
  face: [string, string]
  ink: string
  glow: string
}

export const BIOMES: readonly Biome[] = ['water', 'forest', 'meadow', 'mountain', 'fauna']

export const BIOME_INFO: Record<Biome, BiomeInfo> = {
  water: {
    name: 'Water',
    epithet: 'Spring',
    emoji: '💧',
    face: ['#b7eef4', '#2a9eb4'],
    ink: '#0e5c6b',
    glow: '#7ed7e4',
  },
  forest: {
    name: 'Forest',
    epithet: 'Grove',
    emoji: '🌲',
    face: ['#9ed7a4', '#1f7a45'],
    ink: '#0d3d24',
    glow: '#7dcaa0',
  },
  meadow: {
    name: 'Meadow',
    epithet: 'Flora',
    emoji: '🌿',
    face: ['#e7ef9a', '#c4a43a'],
    ink: '#5c4a12',
    glow: '#e4d56a',
  },
  mountain: {
    name: 'Mountain',
    epithet: 'Stone',
    emoji: '⛰️',
    face: ['#d9d4ea', '#6d6884'],
    ink: '#3a3650',
    glow: '#c4bddf',
  },
  fauna: {
    name: 'Fauna',
    epithet: 'Wildlife',
    emoji: '🦊',
    face: ['#f8c2ae', '#d4654a'],
    ink: '#6e2e22',
    glow: '#f0a48a',
  },
}

export const SEASONS = [
  { id: 'spring', name: 'Spring' },
  { id: 'summer', name: 'Summer' },
  { id: 'autumn', name: 'Autumn' },
  { id: 'winter', name: 'Winter' },
] as const

export const MILESTONES = [100, 250, 500, 1000, 1600, 2500, 4000, 6000, 9000, 13000, 18000, 25000] as const

export const DAILY_LENGTH = 40

/** Zen opens with a finite tile purse. Placing spends one. */
export const STARTING_SEEDS = 25

export const SEED_BOUNTY_REWARD = 4

export const SEED_MILESTONE_REWARD = 6

export const BOUNTY_SCORE = 20

export const RESCUE_SCORE = 15

export type BountyId = 'river4' | 'fauna' | 'meadow4' | 'grove5' | 'peaks3' | 'ash'

export interface Bounty {
  id: BountyId
  label: string
}

export const BOUNTY_ORDER: readonly BountyId[] = ['river4', 'fauna', 'meadow4', 'grove5', 'peaks3', 'ash']

export const BOUNTY_LABEL: Record<BountyId, string> = {
  river4: 'Build a 4-tile River',
  fauna: 'Trigger a Complete Ecosystem with Fauna',
  meadow4: 'Surround a Meadow with 4 biomes',
  grove5: 'Grow a grove of 5 forests',
  peaks3: 'Raise 3 connected peaks',
  ash: 'Root a meadow in fertile ash',
}

export type EndReason = 'harmony' | 'seeds'

export function bountyById(id: BountyId): Bounty {
  return { id, label: BOUNTY_LABEL[id] }
}

export interface Settings {
  muted: boolean
  theme: ThemeName
  skin: SkinName
  hintSeen: boolean
}

export interface DailyRecord {
  score: number
  harmony: number
  grade: string
  label: string
}

export interface Stats {
  infiniteBest: number
  dailyBest: number
  dailyByDate: Record<string, DailyRecord>
  streak: number
  lastDailyDate: string
}
