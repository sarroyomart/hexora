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

export interface Settings {
  muted: boolean
  theme: ThemeName
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
