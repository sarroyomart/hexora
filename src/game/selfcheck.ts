import { assessBiodiversity, applyWildcard, climateThresholds, createGame, deal, placeTile, previewPlacement } from './engine'
import { restoreHarmony, restoreSeeds } from './monetization'
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
  assert(first.effects.gained === 2 && first.effects.lost === 0, 'water gain/loss split')
  assert(!first.state.goldenFlow && first.state.goldenReady, 'the first clean synergy should only charge golden flow')
  assert(first.effects.multiplier === 1, 'the first tile stays at 1×')
  assert(first.state.seeds === 24, `seeds after one tile ${first.state.seeds}`)
  assert(first.effects.breakdown.includes('grove'), `water breakdown ${first.effects.breakdown}`)
  assert(first.effects.banner === '+2', `water banner ${first.effects.banner}`)
  assert(JSON.stringify(state) === snapshot, 'placeTile mutated its input')
  state = play(first.state, 2, 0).state
  const river = play(state, 3, 0)
  assert(river.effects.points === 5, `river bonus ${river.effects.points}`)
  assert(river.effects.breakdown.includes('river'), `river breakdown ${river.effects.breakdown}`)
  assert(river.state.tiles.filter((tile) => tile.condition === 'river').length === 3, 'three river tiles')

  state = fresh(2, ['water', 'mountain'])
  state = play(state, 1, 0).state
  const amplified = play(state, 1, 1)
  assert(amplified.effects.points === 4, `mountain amplify ${amplified.effects.points}`)
  assert(amplified.state.goldenFlow && amplified.effects.multiplier === 2, 'the second clean synergy at full harmony should light golden flow')

  state = fresh(3, ['mountain', 'water'])
  state = play(state, 0, 1).state
  const doubled = play(state, 1, 0)
  assert(doubled.effects.points === 4, `water beside peak ${doubled.effects.points}`)
  assert(doubled.effects.breakdown.includes('peak'), `peak breakdown ${doubled.effects.breakdown}`)

  const meadow = play(fresh(4, ['meadow']), 1, 0)
  assert(meadow.effects.points === 3, `meadow biodiversity ${meadow.effects.points}`)
  assert(!meadow.effects.surge, 'a +3 meadow should not surge')

  state = fresh(5, ['water', 'meadow', 'fauna'])
  state = play(state, 1, 0).state
  state = play(state, 0, 1).state
  const fauna = play(state, -1, 1)
  assert(fauna.effects.points === 8, `ecosystem ${fauna.effects.points}`)
  assert(fauna.effects.breakdown.includes('mosaic'), `fauna breakdown ${fauna.effects.breakdown}`)
  assert(fauna.state.score === 16, `ecosystem total ${fauna.state.score}`)

  state = fresh(6, ['water', 'meadow', 'mountain', 'fauna'])
  state = play(state, 1, 0).state
  state = play(state, -1, 0).state
  const peak = play(state, 1, -1)
  assert(peak.effects.points === 4, `peak bonus ${peak.effects.points}`)
  const nested = play(peak.state, 0, -1)
  assert(nested.effects.points === 16, `doubled fauna ${nested.effects.points}`)
  assert(nested.effects.surge, 'a raw +8 fauna should surge')
  assert(nested.effects.banner === '+16', `fauna banner ${nested.effects.banner}`)
  assert(nested.effects.detail.includes('×2 peak'), `fauna detail ${nested.effects.detail}`)

  state = fresh(7, ['meadow', 'meadow', 'fauna', 'meadow'])
  state = play(state, 1, 0).state
  state = play(state, 2, 0).state
  const lonely = play(state, 3, 0)
  const creature = lonely.state.tiles.find((tile) => tile.kind === 'fauna')
  assert(creature?.vitality === 1, `vitality ${creature?.vitality}`)
  const gone = play(lonely.state, 4, 0)
  assert(!gone.state.tiles.some((tile) => tile.kind === 'fauna'), 'fauna should vanish')
  assert(gone.effects.imbalances.includes('extinction'), 'extinction missing')
  assert(gone.effects.lost === 3 && gone.effects.banner === 'Extinction', `extinction banner ${gone.effects.banner}`)
  assert(
    gone.effects.floaters.some((note) => note.text === '−3') && gone.effects.floaters.some((note) => note.text === '−15%'),
    'extinction should float score and harmony',
  )

  state = fresh(8, ['mountain', 'mountain', 'mountain', 'mountain'])
  state = play(state, 1, 0).state
  state = play(state, 2, 0).state
  state = play(state, 3, 0).state
  const slide = play(state, 4, 0)
  const crater = slide.state.tiles.find((tile) => tile.q === 2 && tile.r === 0)
  assert(crater?.condition === 'crater', `expected crater, got ${crater?.condition}`)
  assert(slide.effects.imbalances.includes('landslide'), 'landslide missing')
  assert(slide.state.harmony === 56, `landslide harmony ${slide.state.harmony}`)
  assert(slide.effects.stagnant, 'a scoreless peak should stagnate')
  assert(slide.effects.floaters.some((note) => note.text === 'Stagnant −6%'), 'stagnant floater missing')
  assert(slide.effects.floaters.some((note) => note.text === '−20%'), 'landslide should float a harmony hit')
  assert(slide.effects.detail.includes('−20%'), `landslide detail ${slide.effects.detail}`)
  assert(slide.effects.harmonyDelta === -26, `landslide harmony delta ${slide.effects.harmonyDelta}`)

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
  assert(flood.effects.banner === 'Flood', `flood banner ${flood.effects.banner}`)
  assert(flood.effects.floaters.some((note) => note.text === '−20%'), 'flood should float a harmony hit')
  assert(flood.effects.detail.includes('−20%'), `flood detail ${flood.effects.detail}`)
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
  assert(burn.effects.banner === 'Wildfire', `wildfire banner ${burn.effects.banner}`)
  assert(burn.effects.floaters.some((note) => note.text === '−25%'), 'wildfire should float a harmony hit')
  assert(burn.state.tiles.filter((tile) => tile.condition === 'fertileAsh').length === 3, 'three groves should burn')
  assert(burn.state.harmony === 41, `wildfire harmony ${burn.state.harmony}`)
  const ashed = play(burn.state, 7, 0)
  assert(ashed.effects.points === 2, `ash meadow scored ${ashed.effects.points}`)
  assert(ashed.effects.detail.includes('×2 ash'), `ash detail ${ashed.effects.detail}`)

  state = fresh(12, ['meadow', 'forest', 'forest', 'forest', 'forest', 'forest', 'forest', 'water'])
  state = play(state, 1, 0).state
  for (const q of [2, 3, 4, 5, 6, 7]) state = play(state, q, 0).state
  const saved = play(state, 8, 0)
  assert(!saved.state.tiles.some((tile) => tile.condition === 'fertileAsh' || tile.condition === 'drought'), 'water should save the grove')
  assert(saved.effects.detail.includes('Quelled'), `expected Quelled, got ${saved.effects.detail}`)
  assert(saved.effects.rescue, 'watering a drought on the warning turn is a rescue')
  assert(saved.effects.floaters.some((note) => note.text === 'DISASTER AVERTED! +15'), 'rescue callout missing')

  const ring = [
    [1, 0],
    [1, -1],
    [0, -1],
    [-1, 0],
    [-1, 1],
    [0, 1],
  ] as const
  state = fresh(13, ['forest', 'forest', 'forest', 'forest', 'forest', 'forest'])
  let ringIndex = 0
  for (const [q, r] of ring) {
    const step = play(state, q, r)
    assert(step.effects.points === (ringIndex === 0 ? 2 : 4), `ring grove scored ${step.effects.points}`)
    state = step.state
    ringIndex += 1
  }
  assert(!state.tiles.some((tile) => tile.condition === 'drought'), 'the seed keeps the first ring watered')

  const preview = previewPlacement(fresh(14, ['water']), 1, 0)
  const committed = placeTile(fresh(14, ['water']), 1, 0)
  assert(preview.points === committed.effects.points && preview.valid, 'preview diverged from placement')
  assert(preview.breakdown === committed.effects.breakdown && preview.banner === committed.effects.banner, 'preview label diverged')

  state = { ...fresh(15, ['meadow']), score: 97 }
  const season = play(state, 1, 0)
  assert(season.state.score === 100, `milestone score ${season.state.score}`)
  assert(season.state.seeds === 30, `milestone seeds ${season.state.seeds}`)
  assert(season.effects.seedsGained === 6, `milestone seed refund ${season.effects.seedsGained}`)
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
  assert(revived.harmony === 30 && revived.revived && !revived.gameOver && revived.endReason === null, 'second chance should return 30% harmony')
  assert(restoreHarmony(revived) === revived, 'second chance is once per run')

  const opened = createGame('infinite', { seed: 4 })
  assert(opened.seeds === 25 && opened.bounty.id === 'river4', 'zen should open with 25 seeds and a river bounty')
  assert(climateThresholds(14).drought === 6 && climateThresholds(14).flood === 5, 'early climate stays loose')
  assert(climateThresholds(15).drought === 5 && climateThresholds(15).flood === 4, 'turn 15 tightens thresholds')
  assert(climateThresholds(30).drought === 5 && climateThresholds(45).flood === 4, 'later shifts hold the tightened line')

  let purse = deal(createGame('infinite', { seed: 21 }), ['water', 'water', 'water', 'water'])
  purse = play(purse, 1, 0).state
  purse = play(purse, 2, 0).state
  purse = play(purse, 3, 0).state
  const riverBounty = play(purse, 4, 0)
  assert(riverBounty.effects.bounty === 'Build a 4-tile River', `bounty ${riverBounty.effects.bounty}`)
  assert(riverBounty.state.seeds === 25, `bounty seeds ${riverBounty.state.seeds}`)
  assert(riverBounty.effects.seedsGained === 4, `bounty seed refund ${riverBounty.effects.seedsGained}`)
  assert(riverBounty.state.bounty.id === 'fauna', 'the next bounty should deal immediately')

  const quiet = play({ ...deal(createGame('infinite', { seed: 22 }), ['mountain']), harmony: 40 }, 1, 0)
  assert(quiet.state.harmony === 34 && quiet.effects.stagnant, `stagnant harmony ${quiet.state.harmony}`)

  const aged = play({ ...deal(createGame('infinite', { seed: 23 }), ['meadow']), turn: 15, harmony: 40, goldenFlow: false, goldenReady: false }, 1, 0)
  assert(aged.state.turn === 16 && aged.state.harmony === 42, `late-game synergy harmony ${aged.state.harmony}`)
  assert(!aged.effects.floaters.some((note) => note.text.includes('Entropy')), 'entropy should not drain a scoring turn')

  const broke = play(play(deal(createGame('infinite', { seed: 24 }), ['water', 'mountain']), 1, 0).state, -1, 0)
  assert(!broke.state.goldenFlow && !broke.state.goldenReady && broke.effects.stagnant, 'a blank turn should break golden flow')

  const emptyPurse = play({ ...deal(createGame('infinite', { seed: 25 }), ['mountain']), seeds: 1, harmony: 80 }, 1, 0)
  assert(emptyPurse.state.gameOver && emptyPurse.state.endReason === 'seeds' && emptyPurse.state.harmony === 74, 'seeds should end a living run')
  assert(emptyPurse.state.log.includes('seed supply'), emptyPurse.state.log)
  const reseeded = restoreSeeds(emptyPurse.state)
  assert(reseeded.seeds === 8 && !reseeded.gameOver && reseeded.revived, 'seed continue should return 8 seeds')
  assert(restoreSeeds(reseeded) === reseeded, 'seed continue is once per run')
  assert(restoreHarmony(emptyPurse.state) === emptyPurse.state, 'harmony continue should not answer a seed loss')

  const both = play({ ...deal(createGame('infinite', { seed: 26 }), ['mountain']), seeds: 1, harmony: 6 }, 1, 0)
  assert(both.state.endReason === 'harmony' && both.state.harmony === 0, 'harmony collapse wins when both hit zero')

  let climate = deal(createGame('infinite', { seed: 27 }), ['meadow', 'forest', 'forest', 'forest', 'forest', 'forest', 'meadow'])
  climate = play(climate, 1, 0).state
  for (const q of [2, 3, 4, 5, 6]) climate = play(climate, q, 0).state
  assert(!climate.tiles.some((tile) => tile.condition === 'drought'), 'five groves should not drought before the shift')
  const shifted = play({ ...climate, turn: 14, harmony: 70 }, 1, 1)
  assert(shifted.state.tiles.filter((tile) => tile.condition === 'drought').length === 5, 'climate shift should drought a grove of five')
  assert(shifted.effects.climate, 'turn 15 should announce the climate shift')
  assert(
    shifted.effects.toasts.some((toast) => toast.text === 'Climate Shift: Ecosystem thresholds tightened!'),
    'climate toast missing',
  )
  const laterClimate = play({ ...shifted.state, turn: 29, harmony: 70 }, 0, 1)
  assert(!laterClimate.effects.climate, 'later turns should not repeat the climate toast')

  let flooded = deal(createGame('infinite', { seed: 28 }), ['water', 'water', 'water', 'water', 'water', 'meadow'])
  flooded = play(flooded, 1, 0).state
  flooded = play(flooded, 2, 0).state
  flooded = play(flooded, 2, -1).state
  flooded = play(flooded, 3, -1).state
  flooded = play(flooded, 3, 0).state
  assert(!flooded.tiles.some((tile) => tile.condition === 'swamp'), 'four springs should not flood before the shift')
  const tightFlood = play({ ...flooded, turn: 14, harmony: 80 }, 0, 1)
  const tightSwamp = tightFlood.state.tiles.find((tile) => tile.q === 2 && tile.r === 0)
  assert(tightSwamp?.condition === 'swamp', `tight flood left ${tightSwamp?.condition}`)

  assert(ashed.effects.formations.includes('ash-garden'), 'a meadow in fertile ash should enter the atlas')
}

hexRoundtrip()
rules()
console.log('Hexora self-check passed')
