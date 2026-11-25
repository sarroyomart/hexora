import { assessBiodiversity, applyWildcard, createGame, deal, placeTile, previewPlacement } from './engine'
import { restoreHarmony } from './monetization'
import { hexDistance, hexToPixel, neighborsOf, pixelToHex } from './hexMath'
import { dailyNumber } from './seededRandom'
import type { GameState } from './types'

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message)
}

function play(state: GameState, q: number, r: number) {
  const result = placeTile(state, q, r)
  if (!result.effects.valid) throw new Error(`Place ${q},${r} rejected: ${result.effects.reason ?? 'unknown'}`)
  return result
}

function hexRoundtrip(): void {
  for (let q = -8; q <= 8; q++) {
    for (let r = -8; r <= 8; r++) {
      const point = hexToPixel(q, r)
      const back = pixelToHex(point.x, point.y)
      assert(back.q === q && back.r === r, `roundtrip ${q},${r} became ${back.q},${back.r}`)
      const seen = new Set<string>()
      for (const neighbor of neighborsOf(q, r)) {
        const key = `${neighbor.q},${neighbor.r}`
        assert(!seen.has(key), 'duplicate neighbor')
        seen.add(key)
        assert(hexDistance({ q, r }, neighbor) === 1, 'neighbor distance')
      }
      assert(seen.size === 6, 'six neighbors')
    }
  }
}

function fresh(seed: number, deck: GameState['deck']): GameState {
  return deal(createGame('infinite', { seed }), deck)
}

function rules(): void {
  let state = fresh(1, ['water', 'water', 'water', 'meadow'])
  const snapshot = JSON.stringify(state)
  const first = play(state, 1, 0)
  assert(first.effects.points === 2, `water beside seed scored ${first.effects.points}`)
  assert(JSON.stringify(state) === snapshot, 'placeTile mutated its input')
  state = play(first.state, 2, 0).state
  const river = play(state, 3, 0)
  assert(river.effects.points === 5, `river bonus ${river.effects.points}`)
  assert(river.state.tiles.filter((tile) => tile.condition === 'river').length === 3, 'three river tiles')

  state = fresh(2, ['water', 'mountain'])
  state = play(state, 1, 0).state
  const amplified = play(state, 1, 1)
  assert(amplified.effects.points === 2, `mountain amplify ${amplified.effects.points}`)

  state = fresh(3, ['mountain', 'water'])
  state = play(state, 0, 1).state
  const doubled = play(state, 1, 0)
  assert(doubled.effects.points === 4, `water beside peak ${doubled.effects.points}`)

  const meadow = play(fresh(4, ['meadow']), 1, 0)
  assert(meadow.effects.points === 3, `meadow biodiversity ${meadow.effects.points}`)

  state = fresh(5, ['water', 'meadow', 'fauna'])
  state = play(state, 1, 0).state
  state = play(state, 0, 1).state
  const fauna = play(state, -1, 1)
  assert(fauna.effects.points === 4, `ecosystem ${fauna.effects.points}`)
  assert(fauna.state.score === 9, `ecosystem total ${fauna.state.score}`)

  state = fresh(6, ['water', 'meadow', 'mountain', 'fauna'])
  state = play(state, 1, 0).state
  state = play(state, -1, 0).state
  const peak = play(state, 1, -1)
  assert(peak.effects.points === 2, `peak bonus ${peak.effects.points}`)
  const nested = play(peak.state, 0, -1)
  assert(nested.effects.points === 8, `doubled fauna ${nested.effects.points}`)

  state = fresh(7, ['meadow', 'meadow', 'fauna', 'meadow'])
  state = play(state, 1, 0).state
  state = play(state, 2, 0).state
  const lonely = play(state, 3, 0)
  const creature = lonely.state.tiles.find((tile) => tile.kind === 'fauna')
  assert(creature?.vitality === 1, `vitality ${creature?.vitality}`)
  const gone = play(lonely.state, 4, 0)
  assert(!gone.state.tiles.some((tile) => tile.kind === 'fauna'), 'fauna should vanish')
  assert(gone.effects.imbalances.includes('extinction'), 'extinction missing')

  state = fresh(8, ['mountain', 'mountain', 'mountain', 'mountain'])
  state = play(state, 1, 0).state
  state = play(state, 2, 0).state
  state = play(state, 3, 0).state
  const slide = play(state, 4, 0)
  const crater = slide.state.tiles.find((tile) => tile.q === 2 && tile.r === 0)
  assert(crater?.condition === 'crater', `expected crater, got ${crater?.condition}`)
  assert(slide.effects.imbalances.includes('landslide'), 'landslide missing')
  assert(slide.state.harmony === 80, `landslide harmony ${slide.state.harmony}`)

  state = fresh(9, ['mountain', 'mountain', 'mountain', 'mountain', 'mountain'])
  state = play(state, 1, 0).state
  state = play(state, 2, 0).state
  state = play(state, 1, -1).state
  state = play(state, 3, -1).state
  const blocked = placeTile(state, 2, -1)
  assert(!blocked.effects.valid && blocked.effects.reason === 'Too many peaks', blocked.effects.reason ?? 'placed')
  assert(blocked.state === state, 'invalid placement should return the same state')

  state = fresh(10, ['water', 'water', 'water', 'water', 'water', 'water', 'forest'])
  state = play(state, 1, 0).state
  state = play(state, 2, 0).state
  state = play(state, 2, -1).state
  state = play(state, 2, 1).state
  state = play(state, 3, -1).state
  const flood = play(state, 1, 1)
  const swamp = flood.state.tiles.find((tile) => tile.q === 2 && tile.r === 0)
  assert(swamp?.condition === 'swamp', `expected swamp, got ${swamp?.condition}`)
  assert(flood.state.tiles.filter((tile) => tile.condition === 'swamp').length === 1, 'only the inner spring floods')
  assert(flood.effects.imbalances.includes('flood'), 'flood missing')
  assert(flood.state.harmony === 80, `flood harmony ${flood.state.harmony}`)
  const drained = play(flood.state, 3, 0)
  const recovered = drained.state.tiles.find((tile) => tile.q === 2 && tile.r === 0)
  assert(recovered?.kind === 'water' && recovered.condition !== 'swamp', `drain left ${recovered?.condition}`)
  assert(drained.effects.points === 4, `grove beside swamp scored ${drained.effects.points}`)

  state = fresh(11, ['meadow', 'forest', 'forest', 'forest', 'forest', 'forest', 'forest', 'meadow', 'meadow'])
  state = play(state, 1, 0).state
  for (const q of [2, 3, 4, 5, 6]) state = play(state, q, 0).state
  const dry = play(state, 7, 0)
  assert(dry.state.tiles.filter((tile) => tile.condition === 'drought').length === 6, 'drought should mark six groves')
  assert(!dry.effects.imbalances.includes('wildfire'), 'drought must wait a turn')
  const burn = play(dry.state, 2, 1)
  assert(burn.effects.imbalances.includes('wildfire'), 'wildfire missing')
  assert(burn.state.tiles.filter((tile) => tile.condition === 'fertileAsh').length === 3, 'three groves should burn')
  assert(burn.state.harmony === 75, `wildfire harmony ${burn.state.harmony}`)
  const ashed = play(burn.state, 7, 0)
  assert(ashed.effects.points === 2, `ash meadow scored ${ashed.effects.points}`)
  assert(ashed.effects.detail === 'Ash ×2', `ash detail ${ashed.effects.detail}`)

  state = fresh(12, ['meadow', 'forest', 'forest', 'forest', 'forest', 'forest', 'forest', 'water'])
  state = play(state, 1, 0).state
  for (const q of [2, 3, 4, 5, 6, 7]) state = play(state, q, 0).state
  const saved = play(state, 8, 0)
  assert(!saved.state.tiles.some((tile) => tile.condition === 'fertileAsh' || tile.condition === 'drought'), 'water should save the grove')
  assert(saved.effects.detail === 'Quelled', `expected Quelled, got ${saved.effects.detail}`)

  const ring = [
    [1, 0],
    [1, -1],
    [0, -1],
    [-1, 0],
    [-1, 1],
    [0, 1],
  ] as const
  state = fresh(13, ['forest', 'forest', 'forest', 'forest', 'forest', 'forest'])
  for (const [q, r] of ring) {
    const step = play(state, q, r)
    assert(step.effects.points === 2, `ring grove scored ${step.effects.points}`)
    state = step.state
  }
  assert(!state.tiles.some((tile) => tile.condition === 'drought'), 'the seed keeps the first ring watered')

  const preview = previewPlacement(fresh(14, ['water']), 1, 0)
  const committed = placeTile(fresh(14, ['water']), 1, 0)
  assert(preview.points === committed.effects.points && preview.valid, 'preview diverged from placement')

  state = { ...fresh(15, ['meadow']), score: 97 }
  const season = play(state, 1, 0)
  assert(season.state.score === 100, `milestone score ${season.state.score}`)
  assert(season.state.wildcards === 1, 'wildcard missing')
  assert(season.state.season === 1 && season.effects.milestone === 'Summer', 'season did not turn')

  const cleared = applyWildcard(season.state, { type: 'clear', q: 1, r: 0 })
  assert(cleared.effects.valid, 'wildcard should clear')
  assert(cleared.state.wildcards === 0, 'wildcard was not spent')
  assert(!cleared.state.tiles.some((tile) => tile.q === 1 && tile.r === 0), 'tile remained')
  const sacred = applyWildcard({ ...cleared.state, wildcards: 1 }, { type: 'clear', q: 0, r: 0 })
  assert(!sacred.effects.valid, 'the seed must stay')

  state = { ...dry.state, harmony: 20 }
  const ended = play(state, 2, 1)
  assert(ended.state.gameOver && ended.state.harmony === 0, 'harmony should end the run')

  const today = createGame('daily', { date: '2026-11-25' })
  const again = createGame('daily', { date: '2026-11-25' })
  const tomorrow = createGame('daily', { date: '2026-11-26' })
  assert(today.dailyNumber === 329, `daily number ${today.dailyNumber}`)
  assert(dailyNumber('2026-01-01') === 1, 'epoch')
  assert(today.deck.length === 40 && today.deck.join() === again.deck.join(), 'daily deck is not deterministic')
  assert(today.deck.join() !== tomorrow.deck.join(), 'consecutive days should differ')
  assert(assessBiodiversity(today.tiles).grade === 'D', 'a lone seed is a monoculture')

  const revived = restoreHarmony(ended.state)
  assert(revived.harmony === 30 && revived.revived && !revived.gameOver, 'second chance should return 30% harmony')
  assert(restoreHarmony(revived) === revived, 'second chance is once per run')
}

hexRoundtrip()
rules()
console.log('Hexora self-check passed')
