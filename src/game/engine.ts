import { hexDistance, hexKey, neighborsOf } from './hexMath'
import { dailyNumber, hashSeed, shuffle, todayString } from './seededRandom'
import {
  BIOME_INFO,
  DAILY_LENGTH,
  MILESTONES,
  SEASONS,
  type Biome,
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
  tone: 'good' | 'bad'
}

export interface PlacementEffects {
  valid: boolean
  reason?: string
  points: number
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

function scoreWater(tile: Tile, board: Board, suppressMountain?: string): number {
  let groves = 0
  let meadows = 0
  let peaks = 0
  for (const neighbor of neighbors(board, tile.q, tile.r)) {
    if (providesForest(neighbor)) groves += 1
    if (isMeadow(neighbor)) meadows += 1
    if (isPeak(neighbor) && hexKey(neighbor.q, neighbor.r) !== suppressMountain) peaks += 1
  }
  let points = 2 * (groves + meadows)
  const component = connected(board, hexKey(tile.q, tile.r), isHealthyWater)
  if (component.length >= 3) points += 5
  if (peaks > 0) points *= 2
  return points
}

function scoreForest(tile: Tile, board: Board): number {
  let springs = 0
  let fauna = 0
  for (const neighbor of neighbors(board, tile.q, tile.r)) {
    if (providesWater(neighbor)) springs += 1
    if (isFauna(neighbor)) fauna += 1
  }
  return springs * 2 + fauna
}

function scoreMeadow(tile: Tile, board: Board, onAsh: boolean): number {
  const kinds = new Set<string>()
  for (const neighbor of neighbors(board, tile.q, tile.r)) {
    if (providesWater(neighbor)) kinds.add('water')
    if (providesForest(neighbor)) kinds.add('forest')
    if (isPeak(neighbor)) kinds.add('mountain')
    if (isFauna(neighbor)) kinds.add('fauna')
  }
  const points = 1 + kinds.size
  return onAsh ? points * 2 : points
}

function scoreFauna(tile: Tile, board: Board, suppressMountain?: string): number {
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
  if (!water || !forest || !meadow) return 0
  return mountain ? 8 : 4
}

function amplifyBonus(tile: Tile, board: Board): number {
  const self = hexKey(tile.q, tile.r)
  let bonus = 0
  for (const neighbor of neighbors(board, tile.q, tile.r)) {
    if (isHealthyWater(neighbor)) {
      bonus += scoreWater(neighbor, board) - scoreWater(neighbor, board, self)
    } else if (isFauna(neighbor)) {
      bonus += scoreFauna(neighbor, board) - scoreFauna(neighbor, board, self)
    }
  }
  return bonus
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

function claimMilestones(state: GameState): string | null {
  let latest: string | null = null
  while (state.milestonesClaimed < MILESTONES.length && state.score >= MILESTONES[state.milestonesClaimed]!) {
    state.milestonesClaimed += 1
    state.wildcards += 1
    state.season = (state.season + 1) % SEASONS.length
    latest = SEASONS[state.season]?.name ?? 'Spring'
  }
  return latest
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
  let placedCollapsed = false

  if (biome === 'mountain') {
    const cluster = connected(board, hexKey(q, r), isPeak)
    if (cluster.length >= 4) {
      const members = cluster.map((key) => board.get(key)).filter((tile): tile is Tile => !!tile)
      const center = landslideCenter(members)
      center.condition = 'crater'
      imbalances.push('landslide')
      floaters.push({ q: center.q, r: center.r, text: 'Landslide', tone: 'bad' })
      toasts.push({ text: 'The range gives way. A crater remains.', tone: 'bad' })
      if (center.q === q && center.r === r) placedCollapsed = true
    }
  }

  if (!placedCollapsed) {
    if (biome === 'water') gained = scoreWater(placed, board)
    else if (biome === 'forest') gained = scoreForest(placed, board)
    else if (biome === 'meadow') gained = scoreMeadow(placed, board, spot.onAsh)
    else if (biome === 'fauna') gained = scoreFauna(placed, board)
    else gained = amplifyBonus(placed, board)
    if (gained > 0) floaters.push({ q, r, text: `+${gained}`, tone: 'good' })
  }

  const markedSwamp: Tile[] = []
  for (const tile of board.values()) {
    if (!isHealthyWater(tile)) continue
    const waterNeighbors = neighbors(board, tile.q, tile.r).filter((neighbor) => isHealthyWater(neighbor)).length
    if (waterNeighbors >= 5) markedSwamp.push(tile)
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
    floaters.push({ q: focus.q, r: focus.r, text: 'Flood', tone: 'bad' })
    toasts.push({ text: 'Floodwater stills into swamp.', tone: 'bad' })
  } else if (markedSwamp.length > 0 && drained > 0) {
    toasts.push({ text: 'A grove drinks the flood away.', tone: 'good' })
  }

  const due = next.droughts.filter((cluster) => cluster.resolveOnTurn <= turn)
  const kept: DroughtCluster[] = next.droughts.filter((cluster) => cluster.resolveOnTurn > turn)
  let burned = 0
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
    toasts.push({ text: 'Drought takes three groves. Fertile ash remains.', tone: 'bad' })
  }

  const assigned = assignDroughts(board, kept, turn)
  droughtStarted = assigned.started
  next.droughts = assigned.droughts
  if (droughtStarted) toasts.push({ text: 'The grove is drying. Bring water next turn.', tone: 'bad' })

  paintRivers(board)

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
  }
  if (removals.length > 0) {
    imbalances.push('extinction')
    toasts.push({
      text: removals.length > 1 ? 'Wildlife slips out of the mosaic.' : 'A creature slips out of the mosaic.',
      tone: 'bad',
    })
  }

  const net = gained - removals.length * 3
  next.score = Math.max(0, state.score + net)
  let harmony = state.harmony + harmonyGain(gained)
  if (harmony > 100) harmony = 100
  if (stuckFlood.length > 0) harmony -= PENALTY.flood
  if (burned > 0) harmony -= PENALTY.wildfire
  if (imbalances.includes('landslide')) harmony -= PENALTY.landslide
  harmony -= removals.length * PENALTY.extinction
  if (harmony < 0) harmony = 0
  next.harmony = harmony

  const milestone = claimMilestones(next)
  if (milestone) {
    const earned = next.wildcards - state.wildcards
    toasts.push({
      text:
        earned > 1
          ? `${milestone} arrives. ${earned} restoration wildcards take root.`
          : `${milestone} arrives. A restoration wildcard takes root.`,
      tone: 'good',
    })
  }

  next.turn = turn
  next.placedCount = state.placedCount + 1
  next.index = state.index + 1
  next.tiles = boardTiles(board)
  ensureDeck(next)

  const info = BIOME_INFO[biome]
  const sentences: string[] = []
  if (net > 0) sentences.push(`${info.name} settles. +${net}.`)
  else if (net < 0) sentences.push(`${info.name} unsettles the board. ${net}.`)
  else sentences.push(`${info.name} settles quietly.`)
  if (imbalances.includes('landslide')) sentences.push('The heart of the range collapses.')
  else if (imbalances.includes('wildfire')) sentences.push('Three groves burn to fertile ash.')
  else if (imbalances.includes('flood')) sentences.push('Inner springs become swamp.')
  else if (imbalances.includes('extinction')) sentences.push('An isolated creature vanishes.')
  else if (droughtStarted) sentences.push('Drought will bite unless water comes next.')
  else if (droughtSaved) sentences.push('The drying grove recovers.')
  if (milestone) sentences.push(`${milestone} turns.`)
  next.log = sentences.slice(0, 2).join(' ')

  next.gameOver = next.harmony <= 0
  next.victory = next.mode === 'daily' && next.placedCount >= DAILY_LENGTH && !next.gameOver
  if (next.gameOver) {
    next.log = 'The land falls out of balance.'
    next.victory = false
  } else if (next.victory) {
    next.log = 'The day’s mosaic holds.'
  }

  let banner = ''
  let detail = ''
  let tone: PlacementEffects['tone'] = 'neutral'
  if (imbalances.includes('landslide')) {
    banner = 'Landslide'
    tone = 'bad'
  } else if (imbalances.includes('wildfire')) {
    banner = 'Wildfire'
    tone = 'bad'
  } else if (imbalances.includes('flood')) {
    banner = 'Flood'
    tone = 'bad'
  } else if (imbalances.includes('extinction')) {
    banner = 'Extinction'
    tone = 'bad'
  } else if (droughtStarted) {
    banner = gained > 0 ? `+${gained}` : 'Drought'
    detail = 'Drought'
    tone = 'warn'
  } else if (threatened) {
    banner = gained > 0 ? `+${gained}` : 'Fading'
    detail = 'Fading'
    tone = 'warn'
  } else if (gained > 0) {
    banner = `+${gained}`
    tone = 'good'
  } else if (net < 0) {
    banner = `${net}`
    tone = 'bad'
  } else {
    banner = 'Quiet'
    tone = 'neutral'
  }

  if (tone === 'bad' && gained > 0) detail = `+${gained}`
  if (droughtSaved && tone === 'good') detail = 'Quelled'
  if (spot.onAsh && gained > 0 && !detail) detail = 'Ash ×2'

  const effects: PlacementEffects = {
    valid: true,
    points: net,
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
  }

  return { state: next, effects }
}

export function previewPlacement(state: GameState, q: number, r: number): PlacementEffects {
  return placeTile(state, q, r).effects
}

function assignDroughts(
  board: Board,
  previous: DroughtCluster[],
  turn: number,
): { droughts: DroughtCluster[]; started: boolean } {
  const droughts: DroughtCluster[] = []
  const covered = new Set<string>()
  let started = false
  for (const cluster of forestClusters(board)) {
    if (cluster.length < 6 || touchesWater(cluster, board)) continue
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
  ).droughts
  paintRivers(board)

  const next: GameState = {
    ...state,
    tiles: boardTiles(board),
    deck: state.deck.slice(),
    bag: state.bag.slice(),
    droughts,
    wildcards: state.wildcards - 1,
    log: action.type === 'clear' ? 'A hex is cleared back to open ground.' : `The hex becomes ${BIOME_INFO[action.biome].name.toLowerCase()}.`,
  }

  return {
    state: next,
    effects: {
      valid: true,
      points: 0,
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
