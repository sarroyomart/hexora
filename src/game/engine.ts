import { hexDistance, hexKey, neighborsOf } from './hexMath'
import { dailyNumber, hashSeed, shuffle, todayString } from './seededRandom'
import {
  BIOME_INFO,
  BOUNTY_ORDER,
  BOUNTY_SCORE,
  DAILY_LENGTH,
  MILESTONES,
  RESCUE_SCORE,
  SEASONS,
  SEED_BOUNTY_REWARD,
  SEED_MILESTONE_REWARD,
  STARTING_SEEDS,
  bountyById,
  type Biome,
  type Bounty,
  type BountyId,
  type DroughtCluster,
  type GameMode,
  type GameState,
  type Tile,
  type TileCondition,
} from './types'

export type Imbalance = 'flood' | 'wildfire' | 'landslide' | 'extinction'

export interface FloatNote {
  q: number
  r: number
  text: string
  tone: 'good' | 'bad' | 'warn'
}

export interface ToastNote {
  text: string
  tone: 'good' | 'bad' | 'warn'
}

export interface PlacementEffects {
  valid: boolean
  reason?: string
  /** Net score change for this placement, floored at the run's zero. */
  points: number
  /** Points earned by the tile that just landed. */
  gained: number
  /** Points removed this turn, before the score floor. */
  lost: number
  /** Compact reason list for the ghost label, e.g. "+2 grove · ×2 peak". */
  breakdown: string
  harmonyDelta: number
  banner: string
  detail: string
  tone: 'good' | 'bad' | 'warn' | 'neutral'
  floaters: FloatNote[]
  toasts: ToastNote[]
  imbalances: Imbalance[]
  milestone: string | null
  status: string
  sound: 'place' | 'alert' | 'restore' | 'deny'
  /** 2 while Golden Flow doubles this placement's synergy. */
  multiplier: number
  golden: boolean
  surge: boolean
  stagnant: boolean
  climate: boolean
  /** Label of the bounty completed this turn, if any. */
  bounty: string | null
  rescue: boolean
  /** Seeds awarded this turn by a bounty or a score milestone, before the spent tile. */
  seedsGained: number
  /** Atlas formation ids present after this placement. */
  formations: string[]
  focus: { q: number; r: number } | null
}

export interface Biodiversity {
  grade: 'S' | 'A' | 'B' | 'C' | 'D'
  label: string
}

const BAG: readonly Biome[] = [
  'water', 'water', 'water', 'water', 'water',
  'forest', 'forest', 'forest', 'forest', 'forest',
  'meadow', 'meadow', 'meadow', 'meadow', 'meadow',
  'mountain', 'mountain', 'mountain',
  'fauna', 'fauna', 'fauna', 'fauna',
]

const PENALTY = {
  flood: 20,
  wildfire: 25,
  landslide: 20,
  extinction: 15,
} as const

type Board = Map<string, Tile>

function emptyEffects(status: string, reason?: string): PlacementEffects {
  return {
    valid: false,
    reason,
    points: 0,
    gained: 0,
    lost: 0,
    breakdown: '',
    harmonyDelta: 0,
    banner: reason ?? '',
    detail: '',
    tone: 'bad',
    floaters: [],
    toasts: [],
    imbalances: [],
    milestone: null,
    status,
    sound: 'deny',
    multiplier: 1,
    golden: false,
    surge: false,
    stagnant: false,
    climate: false,
    bounty: null,
    rescue: false,
    seedsGained: 0,
    formations: [],
    focus: null,
  }
}

function cloneBoard(tiles: Tile[]): Board {
  const board = new Map<string, Tile>()
  for (const tile of tiles) board.set(hexKey(tile.q, tile.r), { ...tile })
  return board
}

function boardTiles(board: Board): Tile[] {
  return [...board.values()]
}

export function findTile(state: GameState, q: number, r: number): Tile | undefined {
  return state.tiles.find((tile) => tile.q === q && tile.r === r)
}

export function currentBiome(state: GameState): Biome | null {
  if (state.gameOver || state.victory) return null
  return state.deck[state.index] ?? null
}

export function upcomingBiomes(state: GameState): Biome[] {
  if (state.gameOver || state.victory) return []
  return state.deck.slice(state.index + 1, state.index + 3)
}

function pullBag(seed: number): { biomes: Biome[]; rng: number } {
  const shuffled = shuffle(BAG, seed)
  return { biomes: shuffled.items, rng: shuffled.rng }
}

function living(tile: Tile | undefined): tile is Tile {
  return !!tile && tile.condition !== 'crater'
}

function isHealthyWater(tile: Tile | undefined): tile is Tile {
  return !!tile && tile.kind === 'water' && tile.condition !== 'swamp' && tile.condition !== 'crater'
}

function isGrove(tile: Tile | undefined): tile is Tile {
  return !!tile && tile.kind === 'forest' && tile.condition !== 'fertileAsh' && tile.condition !== 'crater'
}

function isPeak(tile: Tile | undefined): tile is Tile {
  return !!tile && tile.kind === 'mountain' && tile.condition !== 'crater'
}

function isMeadow(tile: Tile | undefined): tile is Tile {
  return !!tile && tile.kind === 'meadow' && tile.condition !== 'crater'
}

function isFauna(tile: Tile | undefined): tile is Tile {
  return !!tile && tile.kind === 'fauna' && tile.condition !== 'crater'
}

/** The Ancient Seed nourishes like a grove and a spring, without joining those clusters. */
function providesWater(tile: Tile | undefined): boolean {
  if (!tile) return false
  if (tile.kind === 'core') return true
  return isHealthyWater(tile)
}

function providesForest(tile: Tile | undefined): boolean {
  if (!tile) return false
  if (tile.kind === 'core') return true
  return isGrove(tile)
}

function neighbors(board: Board, q: number, r: number): Tile[] {
  const found: Tile[] = []
  for (const next of neighborsOf(q, r)) {
    const tile = board.get(hexKey(next.q, next.r))
    if (tile) found.push(tile)
  }
  return found
}

function connected(board: Board, start: string, pred: (tile: Tile) => boolean): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const stack = [start]
  while (stack.length > 0) {
    const key = stack.pop() as string
    if (seen.has(key)) continue
    seen.add(key)
    const tile = board.get(key)
    if (!tile || !pred(tile)) continue
    out.push(key)
    for (const next of neighborsOf(tile.q, tile.r)) {
      const neighborKey = hexKey(next.q, next.r)
      if (!seen.has(neighborKey)) stack.push(neighborKey)
    }
  }
  return out
}

function harmonyGain(points: number): number {
  if (points >= 8) return 5
  if (points >= 4) return 3
  if (points > 0) return 2
  return 0
}

interface ScoreParts {
  points: number
  parts: string[]
}

function joinParts(parts: readonly string[]): string {
  return parts.filter(Boolean).join(' · ')
}

function scoreBanner(gained: number, lost: number): string {
  const bits: string[] = []
  if (gained > 0) bits.push(`+${gained}`)
  if (lost > 0) bits.push(`−${lost}`)
  return bits.join(' ')
}

function countPart(value: number, label: string): string {
  return `+${value} ${label}`
}

function scoreWater(tile: Tile, board: Board, suppressMountain?: string): ScoreParts {
  let groves = 0
  let meadows = 0
  let peaks = 0
  for (const neighbor of neighbors(board, tile.q, tile.r)) {
    if (providesForest(neighbor)) groves += 1
    if (isMeadow(neighbor)) meadows += 1
    if (isPeak(neighbor) && hexKey(neighbor.q, neighbor.r) !== suppressMountain) peaks += 1
  }
  const parts: string[] = []
  if (groves > 0) parts.push(countPart(2 * groves, 'grove'))
  if (meadows > 0) parts.push(countPart(2 * meadows, 'meadow'))
  let points = 2 * (groves + meadows)
  const component = connected(board, hexKey(tile.q, tile.r), isHealthyWater)
  if (component.length >= 3) {
    points += 5
    parts.push('+5 river')
  }
  if (peaks > 0) {
    points *= 2
    parts.push('×2 peak')
  }
  return { points, parts }
}

function scoreForest(tile: Tile, board: Board): ScoreParts {
  let springs = 0
  let fauna = 0
  for (const neighbor of neighbors(board, tile.q, tile.r)) {
    if (providesWater(neighbor)) springs += 1
    if (isFauna(neighbor)) fauna += 1
  }
  const parts: string[] = []
  if (springs > 0) parts.push(countPart(springs * 2, 'spring'))
  if (fauna > 0) parts.push(countPart(fauna, 'wildlife'))
  return { points: springs * 2 + fauna, parts }
}

function scoreMeadow(tile: Tile, board: Board, onAsh: boolean): ScoreParts {
  const kinds = new Set<string>()
  for (const neighbor of neighbors(board, tile.q, tile.r)) {
    if (providesWater(neighbor)) kinds.add('water')
    if (providesForest(neighbor)) kinds.add('forest')
    if (isPeak(neighbor)) kinds.add('mountain')
    if (isFauna(neighbor)) kinds.add('fauna')
  }
  const parts = ['+1']
  if (kinds.has('water')) parts.push('+1 spring')
  if (kinds.has('forest')) parts.push('+1 grove')
  if (kinds.has('mountain')) parts.push('+1 peak')
  if (kinds.has('fauna')) parts.push('+1 wildlife')
  let points = 1 + kinds.size
  if (onAsh) {
    points *= 2
    parts.push('×2 ash')
  }
  return { points, parts }
}

function scoreFauna(tile: Tile, board: Board, suppressMountain?: string): ScoreParts {
  let water = false
  let forest = false
  let meadow = false
  let mountain = false
  for (const neighbor of neighbors(board, tile.q, tile.r)) {
    if (providesWater(neighbor)) water = true
    if (providesForest(neighbor)) forest = true
    if (isMeadow(neighbor)) meadow = true
    if (isPeak(neighbor) && hexKey(neighbor.q, neighbor.r) !== suppressMountain) mountain = true
  }
  if (!water || !forest || !meadow) return { points: 0, parts: [] }
  const parts = ['+4 mosaic']
  if (mountain) parts.push('×2 peak')
  return { points: mountain ? 8 : 4, parts }
}

function amplifyBonus(tile: Tile, board: Board): ScoreParts {
  const self = hexKey(tile.q, tile.r)
  let points = 0
  const parts: string[] = []
  for (const neighbor of neighbors(board, tile.q, tile.r)) {
    if (isHealthyWater(neighbor)) {
      const delta = scoreWater(neighbor, board).points - scoreWater(neighbor, board, self).points
      if (delta > 0) {
        points += delta
        parts.push(countPart(delta, 'spring'))
      }
    } else if (isFauna(neighbor)) {
      const delta = scoreFauna(neighbor, board).points - scoreFauna(neighbor, board, self).points
      if (delta > 0) {
        points += delta
        parts.push(countPart(delta, 'mosaic'))
      }
    }
  }
  return { points, parts }
}

function faunaHabitat(tile: Tile, board: Board): boolean {
  return neighbors(board, tile.q, tile.r).some((neighbor) => providesWater(neighbor) || providesForest(neighbor))
}

function touchesWater(keys: string[], board: Board): boolean {
  for (const key of keys) {
    const tile = board.get(key)
    if (!tile) continue
    if (neighbors(board, tile.q, tile.r).some((neighbor) => providesWater(neighbor))) return true
  }
  return false
}

function forestClusters(board: Board): string[][] {
  const seen = new Set<string>()
  const clusters: string[][] = []
  for (const [key, tile] of board) {
    if (seen.has(key) || !isGrove(tile)) continue
    const cluster = connected(board, key, isGrove)
    for (const member of cluster) seen.add(member)
    clusters.push(cluster)
  }
  return clusters
}

function paintRivers(board: Board): void {
  for (const tile of board.values()) {
    if (tile.kind === 'water' && tile.condition === 'river') tile.condition = 'normal'
  }
  const seen = new Set<string>()
  for (const [key, tile] of board) {
    if (seen.has(key) || !isHealthyWater(tile)) continue
    const component = connected(board, key, isHealthyWater)
    for (const member of component) seen.add(member)
    if (component.length >= 3) {
      for (const member of component) {
        const water = board.get(member)
        if (water && water.condition !== 'swamp') water.condition = 'river'
      }
    }
  }
}

function landslideCenter(members: Tile[]): Tile {
  const keys = new Set(members.map((tile) => hexKey(tile.q, tile.r)))
  const ranked = members.map((tile) => {
    const embedded = neighborsOf(tile.q, tile.r).filter((next) => keys.has(hexKey(next.q, next.r))).length
    const reach = members.reduce((sum, other) => sum + hexDistance(tile, other), 0)
    return { tile, embedded, reach }
  })
  ranked.sort(
    (a, b) =>
      b.embedded - a.embedded ||
      a.reach - b.reach ||
      a.tile.placedTurn - b.tile.placedTurn ||
      a.tile.q - b.tile.q ||
      a.tile.r - b.tile.r,
  )
  return ranked[0]?.tile ?? members[0]!
}

function canOccupy(board: Board, q: number, r: number, biome: Biome): { ok: boolean; reason?: string; onAsh: boolean } {
  const existing = board.get(hexKey(q, r))
  if (existing) {
    if (existing.condition === 'crater') return { ok: false, reason: 'The crater is unstable', onAsh: false }
    if (existing.condition === 'fertileAsh') {
      if (biome !== 'meadow') return { ok: false, reason: 'Only a meadow can root in ash', onAsh: false }
      return { ok: true, onAsh: true }
    }
    if (existing.condition === 'swamp') {
      if (biome !== 'meadow') return { ok: false, reason: 'Only a meadow can restore swamp', onAsh: false }
      return { ok: true, onAsh: false }
    }
    return { ok: false, reason: 'Already grown', onAsh: false }
  }

  const anchors = neighbors(board, q, r).filter((tile) => tile.condition !== 'crater')
  if (anchors.length === 0) return { ok: false, reason: 'Place beside living land', onAsh: false }
  if (biome === 'mountain') {
    const peaks = anchors.filter((tile) => isPeak(tile)).length
    if (peaks > 2) return { ok: false, reason: 'Too many peaks', onAsh: false }
  }
  return { ok: true, onAsh: false }
}

function ensureDeck(state: GameState): void {
  if (state.mode === 'daily') return
  while (state.deck.length < state.index + 3) {
    if (state.bag.length === 0) {
      const pulled = pullBag(state.rngState)
      state.rngState = pulled.rng
      state.bag = pulled.biomes
    }
    const next = state.bag.pop()
    if (!next) break
    state.deck.push(next)
  }
}

function claimMilestones(state: GameState): { season: string | null; awards: number } {
  let latest: string | null = null
  let awards = 0
  while (state.milestonesClaimed < MILESTONES.length && state.score >= MILESTONES[state.milestonesClaimed]!) {
    state.milestonesClaimed += 1
    state.wildcards += 1
    if (state.mode === 'infinite') state.seeds += SEED_MILESTONE_REWARD
    state.season = (state.season + 1) % SEASONS.length
    latest = SEASONS[state.season]?.name ?? 'Spring'
    awards += 1
  }
  return { season: latest, awards }
}

export function climateThresholds(turn: number): { drought: number; flood: number } {
  const tight = turn >= 15
  return { drought: tight ? 5 : 6, flood: tight ? 4 : 5 }
}

function nextBounty(current: BountyId): Bounty {
  const index = BOUNTY_ORDER.indexOf(current)
  const id = BOUNTY_ORDER[(index + 1) % BOUNTY_ORDER.length] ?? 'river4'
  return bountyById(id)
}

export function createGame(mode: GameMode, options?: { date?: string; seed?: number }): GameState {
  const date = options?.date ?? todayString()
  let rng =
    options?.seed ??
    (mode === 'daily'
      ? hashSeed(`hexora-daily-${date}`)
      : hashSeed(`hexora-${date}-${Date.now()}-${Math.random()}`))
  if (rng === 0) rng = 1

  const deck: Biome[] = []
  let bag: Biome[] = []
  if (mode === 'daily') {
    while (deck.length < DAILY_LENGTH) {
      const pulled = pullBag(rng)
      rng = pulled.rng
      for (const biome of pulled.biomes) {
        deck.push(biome)
        if (deck.length === DAILY_LENGTH) break
      }
    }
  } else {
    const pulled = pullBag(rng)
    rng = pulled.rng
    bag = pulled.biomes
    while (deck.length < 3 && bag.length > 0) deck.push(bag.pop() as Biome)
  }

  return {
    mode,
    date: mode === 'daily' ? date : '',
    dailyNumber: dailyNumber(date),
    tiles: [{ q: 0, r: 0, kind: 'core', condition: 'normal', vitality: 0, placedTurn: 0 }],
    deck,
    bag,
    index: 0,
    rngState: rng,
    score: 0,
    harmony: 100,
    turn: 0,
    placedCount: 0,
    wildcards: 0,
    milestonesClaimed: 0,
    season: 0,
    droughts: [],
    gameOver: false,
    victory: false,
    revived: false,
    endReason: null,
    seeds: mode === 'infinite' ? STARTING_SEEDS : 0,
    goldenFlow: false,
    goldenReady: false,
    bounty: bountyById('river4'),
    discoveries: [],
    freshDiscoveries: [],
    log: 'The Ancient Seed waits.',
  }
}

/** Replace the draw pile. Used by the rules self-check and left available for replays. */
export function deal(state: GameState, deck: Biome[]): GameState {
  return { ...state, deck: [...deck], index: 0, bag: [] }
}

export function placeTile(state: GameState, q: number, r: number): { state: GameState; effects: PlacementEffects } {
  if (state.gameOver || state.victory) {
    return { state, effects: emptyEffects(state.log, 'This run has ended') }
  }
  if (state.mode === 'infinite' && state.seeds <= 0) {
    return { state, effects: emptyEffects(state.log, 'No seeds left') }
  }
  const biome = state.deck[state.index]
  if (!biome) return { state, effects: emptyEffects(state.log, 'The queue is empty') }

  const board = cloneBoard(state.tiles)
  const spot = canOccupy(board, q, r, biome)
  if (!spot.ok) return { state, effects: emptyEffects(state.log, spot.reason) }

  const next: GameState = {
    ...state,
    tiles: state.tiles,
    deck: state.deck.slice(),
    bag: state.bag.slice(),
    droughts: state.droughts.map((cluster) => ({ ...cluster, keys: cluster.keys.slice() })),
  }

  const turn = state.turn + 1
  const placed: Tile = {
    q,
    r,
    kind: biome,
    condition: 'normal',
    vitality: biome === 'fauna' ? 2 : 0,
    placedTurn: turn,
  }
  board.set(hexKey(q, r), placed)

  const floaters: FloatNote[] = []
  const toasts: ToastNote[] = []
  const imbalances: Imbalance[] = []
  let droughtStarted = false
  let droughtSaved = false
  let threatened = false
  let gained = 0
  let scoreParts: string[] = []
  let placedCollapsed = false

  if (biome === 'mountain') {
    const cluster = connected(board, hexKey(q, r), isPeak)
    if (cluster.length >= 4) {
      const members = cluster.map((key) => board.get(key)).filter((tile): tile is Tile => !!tile)
      const center = landslideCenter(members)
      center.condition = 'crater'
      imbalances.push('landslide')
      floaters.push({ q: center.q, r: center.r, text: `−${PENALTY.landslide}%`, tone: 'bad' })
      toasts.push({ text: 'The range gives way. A crater remains.', tone: 'bad' })
      if (center.q === q && center.r === r) placedCollapsed = true
    }
  }

  if (!placedCollapsed) {
    const scored =
      biome === 'water'
        ? scoreWater(placed, board)
        : biome === 'forest'
          ? scoreForest(placed, board)
          : biome === 'meadow'
            ? scoreMeadow(placed, board, spot.onAsh)
            : biome === 'fauna'
              ? scoreFauna(placed, board)
              : amplifyBonus(placed, board)
    gained = scored.points
    scoreParts = scored.parts
    if (gained > 0) floaters.push({ q, r, text: `+${gained}`, tone: 'good' })
  }

  const climate = climateThresholds(turn)
  const markedSwamp: Tile[] = []
  for (const tile of board.values()) {
    if (!isHealthyWater(tile)) continue
    const waterNeighbors = neighbors(board, tile.q, tile.r).filter((neighbor) => isHealthyWater(neighbor)).length
    if (waterNeighbors >= climate.flood) markedSwamp.push(tile)
  }
  for (const tile of markedSwamp) tile.condition = 'swamp'

  let drained = 0
  for (const tile of board.values()) {
    if (tile.kind !== 'water' || tile.condition !== 'swamp') continue
    const besideGrove = neighbors(board, tile.q, tile.r).some((neighbor) => isGrove(neighbor))
    if (!besideGrove) continue
    tile.condition = 'normal'
    drained += 1
    floaters.push({ q: tile.q, r: tile.r, text: 'Drained', tone: 'good' })
  }
  const stuckFlood = markedSwamp.filter((tile) => tile.condition === 'swamp')
  if (stuckFlood.length > 0) {
    imbalances.push('flood')
    const focus = stuckFlood[0]!
    floaters.push({ q: focus.q, r: focus.r, text: `−${PENALTY.flood}%`, tone: 'bad' })
    toasts.push({ text: 'Floodwater stills into swamp.', tone: 'bad' })
  } else if (markedSwamp.length > 0 && drained > 0) {
    toasts.push({ text: 'A grove drinks the flood away.', tone: 'good' })
  }

  const due = next.droughts.filter((cluster) => cluster.resolveOnTurn <= turn)
  const kept: DroughtCluster[] = next.droughts.filter((cluster) => cluster.resolveOnTurn > turn)
  let burned = 0
  let burnFocus: Tile | undefined
  for (const cluster of due) {
    const live = cluster.keys.filter((key) => isGrove(board.get(key)))
    if (live.length === 0) continue
    const watered = isHealthyWater(placed) && live.some((key) => {
      const tile = board.get(key)
      return !!tile && neighborsOf(tile.q, tile.r).some((nextHex) => nextHex.q === q && nextHex.r === r)
    })
    if (watered) {
      for (const key of live) {
        const tile = board.get(key)
        if (tile && tile.condition === 'drought') tile.condition = 'normal'
      }
      droughtSaved = true
      toasts.push({ text: 'Water reaches the drying grove.', tone: 'good' })
    } else {
      const victims = live
        .map((key) => board.get(key))
        .filter((tile): tile is Tile => !!tile)
        .sort((a, b) => b.placedTurn - a.placedTurn || b.q - a.q)
        .slice(0, 3)
      for (const victim of victims) {
        victim.condition = 'fertileAsh'
        burned += 1
        burnFocus ??= victim
        floaters.push({ q: victim.q, r: victim.r, text: 'Ash', tone: 'warn' })
      }
      for (const key of live) {
        const tile = board.get(key)
        if (tile && tile.condition === 'drought') tile.condition = 'normal'
      }
    }
  }
  if (burned > 0) {
    imbalances.push('wildfire')
    if (burnFocus) floaters.push({ q: burnFocus.q, r: burnFocus.r, text: `−${PENALTY.wildfire}%`, tone: 'bad' })
    toasts.push({ text: 'Drought takes three groves. Fertile ash remains.', tone: 'bad' })
  }

  const assigned = assignDroughts(board, kept, turn, climate.drought)
  droughtStarted = assigned.started
  next.droughts = assigned.droughts
  if (droughtStarted) toasts.push({ text: 'The grove is drying. Bring water next turn.', tone: 'bad' })

  paintRivers(board)

  const criticalFauna: string[] = []
  for (const tile of board.values()) {
    if (isFauna(tile) && tile.vitality === 1) criticalFauna.push(hexKey(tile.q, tile.r))
  }

  const removals: Tile[] = []
  for (const tile of board.values()) {
    if (!isFauna(tile)) continue
    if (faunaHabitat(tile, board)) {
      tile.vitality = 2
      continue
    }
    tile.vitality -= 1
    if (tile.vitality <= 0) removals.push(tile)
    else threatened = true
  }
  for (const tile of removals) {
    board.delete(hexKey(tile.q, tile.r))
    floaters.push({ q: tile.q, r: tile.r, text: '−3', tone: 'bad' })
    floaters.push({ q: tile.q, r: tile.r, text: `−${PENALTY.extinction}%`, tone: 'bad' })
  }
  if (removals.length > 0) {
    imbalances.push('extinction')
    toasts.push({
      text: removals.length > 1 ? 'Wildlife slips out of the mosaic.' : 'A creature slips out of the mosaic.',
      tone: 'bad',
    })
  }

  const lost = removals.length * 3
  const faunaSaved = criticalFauna.some((key) => {
    const tile = board.get(key)
    return !!tile && isFauna(tile) && faunaHabitat(tile, board)
  })
  const rescue = droughtSaved || faunaSaved
  const stagnant = gained === 0
  const clean = gained > 0 && imbalances.length === 0
  const flow = clean && (state.goldenFlow || (state.goldenReady && state.harmony >= 100))
  const multiplier = flow ? 2 : 1
  const scored = gained * multiplier
  if (flow) scoreParts.push('×2 flow')
  const scoreNote = floaters.find((item) => item.q === q && item.r === r && item.text === `+${gained}`)
  if (scoreNote) scoreNote.text = `+${scored}`
  const bountyDone = bountyComplete(state.bounty.id, board, q, r, biome, gained, spot.onAsh)
  const bountyScore = bountyDone ? BOUNTY_SCORE : 0
  const rescueScore = rescue ? RESCUE_SCORE : 0
  const net = scored - lost + bountyScore + rescueScore
  const breakdown = joinParts(scoreParts)
  const surge = gained >= 6

  if (next.mode === 'infinite') next.seeds = Math.max(0, state.seeds - 1)
  next.goldenFlow = flow
  next.goldenReady = clean && (flow || state.harmony >= 100)
  next.score = Math.max(0, state.score + net)

  if (stagnant) floaters.push({ q, r, text: 'Stagnant −6%', tone: 'warn' })
  if (rescue) floaters.push({ q, r, text: 'DISASTER AVERTED! +15', tone: 'good' })
  if (surge) floaters.push({ q, r, text: 'HARMONY SURGE!', tone: 'good' })

  let harmony = state.harmony + harmonyGain(gained)
  if (harmony > 100) harmony = 100
  if (stuckFlood.length > 0) harmony -= PENALTY.flood
  if (burned > 0) harmony -= PENALTY.wildfire
  if (imbalances.includes('landslide')) harmony -= PENALTY.landslide
  harmony -= removals.length * PENALTY.extinction
  if (stagnant) harmony -= 6
  if (harmony > 100) harmony = 100
  if (harmony < 0) harmony = 0
  next.harmony = harmony

  if (bountyDone) {
    if (next.mode === 'infinite') next.seeds += SEED_BOUNTY_REWARD
    next.bounty = nextBounty(state.bounty.id)
    toasts.push({
      text:
        next.mode === 'infinite'
          ? `${state.bounty.label}. +${BOUNTY_SCORE} · +${SEED_BOUNTY_REWARD} seeds.`
          : `${state.bounty.label}. +${BOUNTY_SCORE}.`,
      tone: 'good',
    })
  }

  const claimed = claimMilestones(next)
  const milestone = claimed.season
  if (milestone) {
    const earned = next.wildcards - state.wildcards
    const seedNote = next.mode === 'infinite' ? ` +${earned * SEED_MILESTONE_REWARD} seeds.` : ''
    toasts.push({
      text:
        earned > 1
          ? `${milestone} arrives. ${earned} restoration wildcards take root.${seedNote}`
          : `${milestone} arrives. A restoration wildcard takes root.${seedNote}`,
      tone: 'good',
    })
  }

  const climateShift = turn === 15
  if (climateShift) toasts.push({ text: 'Climate Shift: Ecosystem thresholds tightened!', tone: 'warn' })
  const seedsGained = next.mode === 'infinite' ? Math.max(0, next.seeds - (state.seeds - 1)) : 0

  next.turn = turn
  next.placedCount = state.placedCount + 1
  next.index = state.index + 1
  next.tiles = boardTiles(board)
  ensureDeck(next)

  const info = BIOME_INFO[biome]
  const sentences: string[] = []
  const summary = scoreBanner(scored, lost)
  if (scored > 0 && lost > 0) sentences.push(`${info.name} settles. ${summary}.`)
  else if (scored > lost) sentences.push(`${info.name} settles. +${scored - lost}.`)
  else if (scored < lost) sentences.push(`${info.name} unsettles the board. −${lost - scored}.`)
  else if (stagnant) sentences.push(`${info.name} settles with no synergy.`)
  else sentences.push(`${info.name} settles quietly.`)
  if (imbalances.includes('landslide')) sentences.push('The heart of the range collapses.')
  else if (imbalances.includes('wildfire')) sentences.push('Three groves burn to fertile ash.')
  else if (imbalances.includes('flood')) sentences.push('Inner springs become swamp.')
  else if (imbalances.includes('extinction')) sentences.push('An isolated creature vanishes.')
  else if (droughtStarted) sentences.push('Drought will bite unless water comes next.')
  else if (rescue) sentences.push('Disaster averted.')
  else if (droughtSaved) sentences.push('The drying grove recovers.')
  if (milestone) sentences.push(`${milestone} turns.`)
  next.log = sentences.slice(0, 2).join(' ')

  const formations = scanFormations(board, spot.onAsh)
  const novel = formations.filter((id) => !state.discoveries.includes(id))
  if (novel.length > 0) next.discoveries = [...state.discoveries, ...novel]

  next.victory = next.mode === 'daily' && next.placedCount >= DAILY_LENGTH && next.harmony > 0
  if (next.harmony <= 0) {
    next.harmony = 0
    next.gameOver = true
    next.endReason = 'harmony'
    next.victory = false
    next.log = 'Harmony collapsed.'
  } else if (next.mode === 'infinite' && next.seeds <= 0) {
    next.gameOver = true
    next.endReason = 'seeds'
    next.victory = false
    next.log = 'Seasons complete. The seed supply is exhausted.'
  } else if (next.victory) {
    next.endReason = null
    next.log = 'The day’s mosaic holds.'
  } else {
    next.gameOver = false
    next.endReason = null
  }

  const tags: string[] = []
  if (droughtStarted) tags.push('Drought')
  if (threatened && !droughtStarted) tags.push('Fading')
  if (droughtSaved) tags.push('Quelled')
  if (rescue) tags.push('Averted')
  if (flow) tags.push('Golden')
  if (stagnant) tags.push('Stagnant')
  const hits: string[] = []
  if (imbalances.includes('landslide')) hits.push(`−${PENALTY.landslide}%`)
  if (imbalances.includes('wildfire')) hits.push(`−${PENALTY.wildfire}%`)
  if (imbalances.includes('flood')) hits.push(`−${PENALTY.flood}%`)
  if (imbalances.includes('extinction')) hits.push(`−${removals.length * PENALTY.extinction}%`)

  let banner = ''
  let detail = ''
  let tone: PlacementEffects['tone'] = 'neutral'
  if (imbalances.includes('landslide')) {
    banner = 'Landslide'
    detail = joinParts([summary, breakdown, ...hits, ...tags])
    tone = 'bad'
  } else if (imbalances.includes('wildfire')) {
    banner = 'Wildfire'
    detail = joinParts([summary, breakdown, ...hits, ...tags])
    tone = 'bad'
  } else if (imbalances.includes('flood')) {
    banner = 'Flood'
    detail = joinParts([summary, breakdown, ...hits, ...tags])
    tone = 'bad'
  } else if (imbalances.includes('extinction')) {
    banner = 'Extinction'
    detail = joinParts([summary, breakdown, ...hits, ...tags])
    tone = 'bad'
  } else if (rescue) {
    banner = 'Averted'
    detail = joinParts([summary, breakdown, '+15 rescue', ...tags.filter((tag) => tag !== 'Averted')])
    tone = 'good'
  } else if (summary) {
    banner = summary
    detail = joinParts([breakdown, ...tags])
    tone = lost > 0 ? 'bad' : droughtStarted || threatened ? 'warn' : 'good'
  } else if (stagnant) {
    banner = 'Stagnant'
    detail = joinParts(['−6% harmony', breakdown, ...tags.filter((tag) => tag !== 'Stagnant')])
    tone = 'warn'
  } else if (droughtStarted) {
    banner = 'Drought'
    detail = joinParts([breakdown, ...tags.filter((tag) => tag !== 'Drought')])
    tone = 'warn'
  } else if (threatened) {
    banner = 'Fading'
    detail = joinParts([breakdown, ...tags.filter((tag) => tag !== 'Fading')])
    tone = 'warn'
  } else {
    banner = 'Quiet'
    detail = joinParts(tags)
    tone = 'neutral'
  }

  const effects: PlacementEffects = {
    valid: true,
    points: net,
    gained: scored + bountyScore + rescueScore,
    lost,
    breakdown,
    harmonyDelta: next.harmony - state.harmony,
    banner,
    detail,
    tone,
    floaters,
    toasts,
    imbalances,
    milestone,
    status: next.log,
    sound: imbalances.length > 0 ? 'alert' : 'place',
    multiplier,
    golden: flow,
    surge,
    stagnant,
    climate: climateShift,
    bounty: bountyDone ? state.bounty.label : null,
    rescue,
    seedsGained,
    formations,
    focus: { q, r },
  }

  return { state: next, effects }
}

export function previewPlacement(state: GameState, q: number, r: number): PlacementEffects {
  return placeTile(state, q, r).effects
}

function withoutTile<T>(board: Board, q: number, r: number, run: () => T): T {
  const key = hexKey(q, r)
  const tile = board.get(key)
  board.delete(key)
  try {
    return run()
  } finally {
    if (tile) board.set(key, tile)
  }
}

function clusterReach(board: Board, q: number, r: number, pred: (tile: Tile | undefined) => boolean): { before: number; after: number } {
  const key = hexKey(q, r)
  const after = pred(board.get(key)) ? connected(board, key, pred).length : 0
  const before = withoutTile(board, q, r, () => {
    let max = 0
    const seen = new Set<string>()
    for (const neighbor of neighbors(board, q, r)) {
      const neighborKey = hexKey(neighbor.q, neighbor.r)
      if (seen.has(neighborKey) || !pred(neighbor)) continue
      const cluster = connected(board, neighborKey, pred)
      for (const member of cluster) seen.add(member)
      max = Math.max(max, cluster.length)
    }
    return max
  })
  return { before, after }
}

function meadowKinds(board: Board, tile: Tile): number {
  const kinds = new Set<string>()
  for (const neighbor of neighbors(board, tile.q, tile.r)) {
    if (providesWater(neighbor)) kinds.add('water')
    if (providesForest(neighbor)) kinds.add('forest')
    if (isPeak(neighbor)) kinds.add('mountain')
    if (isFauna(neighbor)) kinds.add('fauna')
  }
  return kinds.size
}

function bountyComplete(
  id: BountyId,
  board: Board,
  q: number,
  r: number,
  biome: Biome,
  raw: number,
  onAsh: boolean,
): boolean {
  if (id === 'river4') {
    const span = clusterReach(board, q, r, isHealthyWater)
    return span.after >= 4 && span.before < 4
  }
  if (id === 'fauna') return biome === 'fauna' && raw >= 4
  if (id === 'meadow4') {
    const reached = [board.get(hexKey(q, r)), ...neighbors(board, q, r)].some(
      (tile) => !!tile && isMeadow(tile) && meadowKinds(board, tile) >= 4,
    )
    if (!reached) return false
    const already = withoutTile(board, q, r, () =>
      neighbors(board, q, r).some((tile) => isMeadow(tile) && meadowKinds(board, tile) >= 4),
    )
    return !already
  }
  if (id === 'grove5') {
    const span = clusterReach(board, q, r, isGrove)
    return span.after >= 5 && span.before < 5
  }
  if (id === 'peaks3') {
    const span = clusterReach(board, q, r, isPeak)
    return span.after >= 3 && span.before < 3
  }
  return onAsh
}

function scanFormations(board: Board, onAsh: boolean): string[] {
  const found = new Set<string>()
  const rivers: string[][] = []
  const seenWater = new Set<string>()
  for (const [key, tile] of board) {
    if (seenWater.has(key) || !isHealthyWater(tile)) continue
    const component = connected(board, key, isHealthyWater)
    for (const member of component) seenWater.add(member)
    if (component.length >= 3) rivers.push(component)
    if (component.length >= 6) found.add('ancient-river')
  }
  if (rivers.length >= 2) found.add('twin-rivers')
  for (const component of rivers) {
    const touchesCore = component.some((key) => {
      const tile = board.get(key)
      return !!tile && neighbors(board, tile.q, tile.r).some((neighbor) => neighbor.kind === 'core')
    })
    const touchesPeak = component.some((key) => {
      const tile = board.get(key)
      return !!tile && neighbors(board, tile.q, tile.r).some((neighbor) => isPeak(neighbor))
    })
    if (touchesCore) found.add('seeded-estuary')
    if (touchesPeak) found.add('glacial-spring')
  }

  for (const cluster of forestClusters(board)) {
    if (cluster.length >= 6 && touchesWater(cluster, board)) found.add('emerald-canopy')
  }

  for (const tile of board.values()) {
    if (isMeadow(tile) && meadowKinds(board, tile) >= 4) found.add('sanctuary-valley')
    if (tile.condition === 'fertileAsh' && neighbors(board, tile.q, tile.r).some((neighbor) => providesWater(neighbor))) {
      found.add('volcanic-lagoon')
    }
    if (isFauna(tile)) {
      const habitat = scoreFauna(tile, board)
      if (habitat.points >= 8) found.add('wild-mosaic')
    }
  }

  const seenPeak = new Set<string>()
  for (const [key, tile] of board) {
    if (seenPeak.has(key) || !isPeak(tile)) continue
    const cluster = connected(board, key, isPeak)
    for (const member of cluster) seenPeak.add(member)
    if (cluster.length < 3) continue
    const watered = cluster.some((member) => {
      const peak = board.get(member)
      return !!peak && neighbors(board, peak.q, peak.r).some((neighbor) => providesWater(neighbor))
    })
    if (watered) found.add('crystal-range')
  }

  if (onAsh) found.add('ash-garden')

  const livingKinds = new Set<string>()
  let housedFauna = 0
  for (const tile of board.values()) {
    if (tile.kind === 'core' || tile.condition === 'crater' || tile.condition === 'fertileAsh' || tile.condition === 'swamp') continue
    livingKinds.add(tile.kind)
    if (isFauna(tile) && faunaHabitat(tile, board)) housedFauna += 1
  }
  if (livingKinds.size >= 5) found.add('living-crown')
  if (housedFauna >= 3) found.add('fauna-procession')

  return [...found]
}

function assignDroughts(
  board: Board,
  previous: DroughtCluster[],
  turn: number,
  droughtAt = 6,
): { droughts: DroughtCluster[]; started: boolean } {
  const droughts: DroughtCluster[] = []
  const covered = new Set<string>()
  let started = false
  for (const cluster of forestClusters(board)) {
    if (cluster.length < droughtAt || touchesWater(cluster, board)) continue
    for (const key of cluster) {
      covered.add(key)
      const tile = board.get(key)
      if (tile && tile.condition === 'normal') tile.condition = 'drought'
    }
    const prior = previous.find((item) => item.keys.some((key) => cluster.includes(key)))
    if (prior) droughts.push({ keys: cluster, resolveOnTurn: prior.resolveOnTurn })
    else {
      droughts.push({ keys: cluster, resolveOnTurn: turn + 1 })
      started = true
    }
  }
  for (const tile of board.values()) {
    if (tile.condition === 'drought' && !covered.has(hexKey(tile.q, tile.r))) tile.condition = 'normal'
  }
  return { droughts, started }
}

export function applyWildcard(
  state: GameState,
  action: { type: 'clear'; q: number; r: number } | { type: 'transform'; q: number; r: number; biome: Biome },
): { state: GameState; effects: PlacementEffects } {
  if (state.wildcards < 1) return { state, effects: emptyEffects(state.log, 'No wildcard rooted') }
  if (state.gameOver || state.victory) return { state, effects: emptyEffects(state.log, 'This run has ended') }

  const board = cloneBoard(state.tiles)
  const key = hexKey(action.q, action.r)
  const tile = board.get(key)
  if (!tile) return { state, effects: emptyEffects(state.log, 'Choose a tile') }
  if (tile.kind === 'core') return { state, effects: emptyEffects(state.log, 'The Ancient Seed stays') }

  if (action.type === 'clear') {
    board.delete(key)
  } else {
    const nextCondition: TileCondition = 'normal'
    board.set(key, {
      ...tile,
      kind: action.biome,
      condition: nextCondition,
      vitality: action.biome === 'fauna' ? 2 : 0,
    })
  }

  const droughts = assignDroughts(
    board,
    state.droughts.map((cluster) => ({ ...cluster, keys: cluster.keys.slice() })),
    state.turn,
    climateThresholds(state.turn).drought,
  ).droughts
  paintRivers(board)
  const formations = scanFormations(board, false)
  const novel = formations.filter((id) => !state.discoveries.includes(id))

  const next: GameState = {
    ...state,
    tiles: boardTiles(board),
    deck: state.deck.slice(),
    bag: state.bag.slice(),
    droughts,
    discoveries: novel.length > 0 ? [...state.discoveries, ...novel] : state.discoveries,
    wildcards: state.wildcards - 1,
    log: action.type === 'clear' ? 'A hex is cleared back to open ground.' : `The hex becomes ${BIOME_INFO[action.biome].name.toLowerCase()}.`,
  }

  return {
    state: next,
    effects: {
      valid: true,
      points: 0,
      gained: 0,
      lost: 0,
      breakdown: '',
      harmonyDelta: 0,
      banner: 'Restored',
      detail: '',
      tone: 'good',
      floaters: [{ q: action.q, r: action.r, text: 'Restored', tone: 'good' }],
      toasts: [],
      imbalances: [],
      milestone: null,
      status: next.log,
      sound: 'restore',
      multiplier: 1,
      golden: state.goldenFlow,
      surge: false,
      stagnant: false,
      climate: false,
      bounty: null,
      rescue: false,
      seedsGained: 0,
      formations,
      focus: { q: action.q, r: action.r },
    },
  }
}

export function assessBiodiversity(tiles: Tile[]): Biodiversity {
  const livingTiles = tiles.filter(
    (tile) =>
      tile.kind !== 'core' &&
      tile.condition !== 'crater' &&
      tile.condition !== 'fertileAsh' &&
      tile.condition !== 'swamp',
  )
  const kinds = new Set(livingTiles.map((tile) => tile.kind))
  const board = cloneBoard(tiles)
  let mixed = 0
  for (const tile of livingTiles) {
    const different = neighbors(board, tile.q, tile.r).some(
      (neighbor) => living(neighbor) && neighbor.kind !== 'core' && neighbor.kind !== tile.kind && neighbor.condition !== 'crater',
    )
    if (different) mixed += 1
  }
  const mix = livingTiles.length === 0 ? 0 : mixed / livingTiles.length
  const variety = kinds.size
  if (variety >= 5 && mix >= 0.72) return { grade: 'S', label: 'Living mosaic' }
  if (variety >= 4 && mix >= 0.55) return { grade: 'A', label: 'Balanced wilds' }
  if (variety >= 3 && mix >= 0.4) return { grade: 'B', label: 'Taking root' }
  if (variety >= 2) return { grade: 'C', label: 'Thin diversity' }
  return { grade: 'D', label: 'Monoculture' }
}

export function seasonName(index: number): string {
  return SEASONS[index % SEASONS.length]?.name ?? 'Spring'
}
