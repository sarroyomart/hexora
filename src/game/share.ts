import { assessBiodiversity } from './engine'
import { hexKey } from './hexMath'
import { BIOME_INFO, type GameState, type Tile } from './types'

function glyph(tile: Tile): string {
  if (tile.kind === 'core') return '🌱'
  if (tile.condition === 'crater') return '⚫'
  if (tile.condition === 'fertileAsh') return '✨'
  if (tile.condition === 'swamp') return '🫧'
  if (tile.condition === 'drought') return '🔥'
  if (tile.kind === 'water') return '💧'
  return BIOME_INFO[tile.kind].emoji
}

export function emojiGrid(tiles: Tile[]): string {
  let minQ = 0
  let maxQ = 0
  let minR = 0
  let maxR = 0
  for (const tile of tiles) {
    minQ = Math.min(minQ, tile.q)
    maxQ = Math.max(maxQ, tile.q)
    minR = Math.min(minR, tile.r)
    maxR = Math.max(maxR, tile.r)
  }
  const board = new Map(tiles.map((tile) => [hexKey(tile.q, tile.r), tile]))
  const lines: string[] = []
  for (let r = minR; r <= maxR; r++) {
    let line = (r - minR) % 2 === 1 ? ' ' : ''
    let living = false
    for (let q = minQ; q <= maxQ; q++) {
      const tile = board.get(hexKey(q, r))
      if (tile) {
        line += glyph(tile)
        living = true
      } else line += '·'
    }
    if (living) lines.push(line.replace(/·+$/u, ''))
  }
  return lines.join('\n')
}

export function buildShareText(state: GameState): string {
  const bio = assessBiodiversity(state.tiles)
  const heading = state.mode === 'daily' ? `Hexora Daily #${state.dailyNumber}` : 'Hexora Zen'
  return [
    heading,
    `Score ${state.score} · Harmony ${Math.round(state.harmony)}% · Biodiversity ${bio.grade}`,
    bio.label,
    '',
    emojiGrid(state.tiles),
  ].join('\n')
}
