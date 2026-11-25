import type { PlacementEffects } from './engine'
import { currentBiome } from './engine'
import { HEX_SIZE, hexKey, hexPolygon, hexToPixel, neighborsOf } from './hexMath'
import { BIOME_INFO, type GameState, type ThemeName, type Tile } from './types'

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  kind: 'leaf' | 'ripple' | 'firefly' | 'ember' | 'pollen' | 'puff'
  rot: number
  spin: number
  size: number
  color: string
}

export interface Floater {
  x: number
  y: number
  text: string
  tone: 'good' | 'bad' | 'warn'
  life: number
}

const FONT = '"Avenir Next", "Segoe UI", "Gill Sans", sans-serif'

const QUIET_REASONS = new Set([
  'Place beside living land',
  'Already grown',
  'This run has ended',
  'The queue is empty',
  'Choose a tile',
  'No wildcard rooted',
  'The Ancient Seed stays',
])

const DAY = [
  ['#f4efe6', '#d7ebdf', '#f6d5e2', '#efe3c8'],
  ['#f7f1d4', '#f0dc93', '#d5e6c0', '#f8e6bf'],
  ['#f6ebdd', '#efc49a', '#e7d0bf', '#f4dec4'],
  ['#eef3f6', '#d5e4ee', '#e6eef3', '#f7f4ee'],
]

const NIGHT = [
  ['#121816', '#1c2e26', '#2a1e26', '#18221c'],
  ['#16140f', '#2c2816', '#182820', '#241e14'],
  ['#1a1410', '#2c1c14', '#241c16', '#1c1814'],
  ['#101418', '#1a2832', '#182228', '#141a1e'],
]

function parseHex(color: string): [number, number, number] {
  const value = color.slice(1)
  return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)]
}

function mix(a: string, b: string, t: number): string {
  const pa = parseHex(a)
  const pb = parseHex(b)
  const c = pa.map((channel, index) => Math.round(channel + ((pb[index] ?? channel) - channel) * t))
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`
}

function seasonColors(theme: ThemeName, season: number): string[] {
  const table = theme === 'night' ? NIGHT : DAY
  const wrapped = ((season % 4) + 4) % 4
  const index = Math.floor(wrapped) % 4
  const next = (index + 1) % 4
  const blend = wrapped - Math.floor(wrapped)
  return (table[index] ?? table[0]!).map((color, slot) => mix(color, table[next]?.[slot] ?? color, blend))
}

function faceOf(tile: Tile): { top: string; bottom: string; ink: string } {
  if (tile.kind === 'core') return { top: '#f8e7b8', bottom: '#d4a24c', ink: '#6a4a16' }
  if (tile.condition === 'swamp') return { top: '#9aa58a', bottom: '#3e4a3a', ink: '#243028' }
  if (tile.condition === 'fertileAsh') return { top: '#6e5e54', bottom: '#2c2623', ink: '#e6c27a' }
  if (tile.condition === 'crater') return { top: '#3a342f', bottom: '#161311', ink: '#8a8178' }
  if (tile.condition === 'drought') return { top: '#e2b56a', bottom: '#8d5a28', ink: '#4a2c12' }
  if (tile.condition === 'river') return { top: '#d7fbff', bottom: '#1c8eac', ink: '#0c5564' }
  const info = BIOME_INFO[tile.kind]
  return { top: info.face[0], bottom: info.face[1], ink: info.ink }
}

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  theme: ThemeName,
  season: number,
  time: number,
): void {
  const colors = seasonColors(theme, season)
  ctx.fillStyle = colors[0] ?? '#f4efe6'
  ctx.fillRect(0, 0, width, height)
  const blooms = [
    { x: width * (0.18 + Math.sin(time * 0.05) * 0.02), y: height * 0.16, r: width * 0.48, color: colors[1] ?? '#d7ebdf' },
    { x: width * 0.86, y: height * (0.18 + Math.cos(time * 0.04) * 0.02), r: width * 0.36, color: colors[2] ?? '#f6d5e2' },
    { x: width * 0.58, y: height * 0.96, r: width * 0.5, color: colors[3] ?? '#efe3c8' },
  ]
  for (const bloom of blooms) {
    const gradient = ctx.createRadialGradient(bloom.x, bloom.y, 0, bloom.x, bloom.y, bloom.r)
    gradient.addColorStop(0, bloom.color)
    gradient.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(bloom.x, bloom.y, bloom.r, 0, Math.PI * 2)
    ctx.fill()
  }
  const vignette = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.2, width / 2, height / 2, Math.max(width, height) * 0.72)
  vignette.addColorStop(0, 'rgba(0,0,0,0)')
  vignette.addColorStop(1, theme === 'night' ? 'rgba(0,0,0,0.38)' : 'rgba(80, 58, 32, 0.08)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, width, height)
}

function traceHex(ctx: CanvasRenderingContext2D, radius: number): void {
  hexPolygon(ctx, radius)
}

function drawSymbol(ctx: CanvasRenderingContext2D, tile: Tile, time: number): void {
  const { ink } = faceOf(tile)
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (tile.kind === 'core') {
    ctx.fillStyle = 'rgba(255,248,230,0.9)'
    const spin = time * 0.25
    for (let i = 0; i < 6; i++) {
      const angle = spin + (i * Math.PI) / 3
      ctx.beginPath()
      ctx.ellipse(Math.cos(angle) * 11, Math.sin(angle) * 11, 5, 2.4, angle, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = ink
    ctx.beginPath()
    ctx.arc(0, 0, 5.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    return
  }
  if (tile.condition === 'crater') {
    ctx.strokeStyle = ink
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.ellipse(0, 2, 12, 7, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(-8, 6)
    ctx.lineTo(-1, 1)
    ctx.moveTo(7, 5)
    ctx.lineTo(2, 0)
    ctx.stroke()
    ctx.restore()
    return
  }
  if (tile.condition === 'fertileAsh') {
    ctx.fillStyle = ink
    for (const [x, y, r] of [
      [-6, -2, 2.2],
      [4, -5, 1.6],
      [7, 4, 2],
      [-2, 6, 1.5],
      [0, 0, 2.4],
    ] as const) {
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
    return
  }
  if (tile.condition === 'swamp') {
    ctx.strokeStyle = ink
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(-12, 2)
    ctx.bezierCurveTo(-4, -4, 4, 8, 12, 2)
    ctx.stroke()
    ctx.fillStyle = 'rgba(220, 230, 210, 0.7)'
    ctx.beginPath()
    ctx.arc(-4, -6, 2.4, 0, Math.PI * 2)
    ctx.arc(6, -2, 1.7, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    return
  }
  if (tile.kind === 'water' || tile.condition === 'river') {
    ctx.strokeStyle = ink
    ctx.lineWidth = 2.1
    for (let i = 0; i < 3; i++) {
      const y = -8 + i * 8
      ctx.beginPath()
      ctx.moveTo(-13, y)
      ctx.bezierCurveTo(-6, y - 4.5, -2, y + 4.5, 0, y)
      ctx.bezierCurveTo(2, y - 4.5, 6, y + 4.5, 13, y)
      ctx.stroke()
    }
    ctx.restore()
    return
  }
  if (tile.kind === 'forest' || tile.condition === 'drought') {
    const tree = (x: number, y: number, h: number, color: string) => {
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.moveTo(x, y - h)
      ctx.lineTo(x + h * 0.48, y)
      ctx.lineTo(x - h * 0.48, y)
      ctx.closePath()
      ctx.fill()
    }
    tree(-5, 6, 16, ink)
    tree(6, 8, 12, 'rgba(255,255,255,0.35)')
    ctx.restore()
    return
  }
  if (tile.kind === 'meadow') {
    ctx.strokeStyle = ink
    ctx.fillStyle = ink
    ctx.lineWidth = 1.6
    for (const [x, y] of [
      [-7, 2],
      [0, -2],
      [7, 3],
    ] as const) {
      ctx.beginPath()
      ctx.moveTo(x, y + 8)
      ctx.quadraticCurveTo(x + 2, y, x, y - 6)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(x, y - 7, 2.3, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
    return
  }
  if (tile.kind === 'mountain') {
    ctx.fillStyle = ink
    ctx.beginPath()
    ctx.moveTo(-12, 8)
    ctx.lineTo(-2, -8)
    ctx.lineTo(4, 8)
    ctx.closePath()
    ctx.fill()
    ctx.globalAlpha = 0.55
    ctx.beginPath()
    ctx.moveTo(-1, 8)
    ctx.lineTo(8, -4)
    ctx.lineTo(13, 8)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
    return
  }
  ctx.fillStyle = ink
  ctx.beginPath()
  ctx.arc(0, 2, 6.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(-4, -6, 2.6, 0, Math.PI * 2)
  ctx.arc(4, -6, 2.6, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.beginPath()
  ctx.arc(-2.2, 1.2, 1.1, 0, Math.PI * 2)
  ctx.arc(2.2, 1.2, 1.1, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawTile(ctx: CanvasRenderingContext2D, tile: Tile, scale: number, time: number, theme: ThemeName): void {
  const point = hexToPixel(tile.q, tile.r)
  const radius = HEX_SIZE * 0.92
  const face = faceOf(tile)
  ctx.save()
  ctx.translate(point.x, point.y)
  ctx.scale(scale, scale)
  if (tile.kind === 'core') {
    const glow = ctx.createRadialGradient(0, 0, 6, 0, 0, radius * 2.1)
    glow.addColorStop(0, 'rgba(232, 196, 106, 0.55)')
    glow.addColorStop(1, 'rgba(232, 196, 106, 0)')
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(0, 0, radius * 2.1, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.save()
  ctx.translate(2.2, 4)
  traceHex(ctx, radius * 0.98)
  ctx.fillStyle = theme === 'night' ? 'rgba(0,0,0,0.35)' : 'rgba(48, 36, 22, 0.16)'
  ctx.fill()
  ctx.restore()
  traceHex(ctx, radius)
  const gradient = ctx.createLinearGradient(0, -radius, 0, radius)
  gradient.addColorStop(0, face.top)
  gradient.addColorStop(1, face.bottom)
  ctx.fillStyle = gradient
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.38)'
  ctx.lineWidth = 1.4
  ctx.stroke()
  if (tile.condition === 'drought') {
    ctx.fillStyle = `rgba(255, 150, 40, ${0.18 + Math.sin(time * 4 + tile.q) * 0.1})`
    ctx.fill()
  }
  if (tile.condition === 'river') {
    ctx.save()
    ctx.clip()
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'
    ctx.lineWidth = 2
    ctx.setLineDash([5, 7])
    ctx.lineDashOffset = -((time * 18 + tile.q * 8) % 24)
    ctx.beginPath()
    ctx.moveTo(-14, 5)
    ctx.bezierCurveTo(-4, -2, 4, 10, 14, 2)
    ctx.stroke()
    ctx.restore()
  }
  drawSymbol(ctx, tile, time)
  ctx.restore()
}

function drawLabel(ctx: CanvasRenderingContext2D, x: number, y: number, title: string, detail: string, tone: PlacementEffects['tone']): void {
  ctx.save()
  ctx.font = `600 15px ${FONT}`
  const titleWidth = ctx.measureText(title).width
  ctx.font = `500 12px ${FONT}`
  const detailWidth = detail ? ctx.measureText(detail).width : 0
  const width = Math.max(titleWidth, detailWidth) + 22
  const height = detail ? 42 : 28
  const left = x - width / 2
  const top = y - height
  ctx.shadowColor = 'rgba(0,0,0,0.16)'
  ctx.shadowBlur = 12
  ctx.shadowOffsetY = 4
  roundRect(ctx, left, top, width, height, 10)
  ctx.fillStyle = tone === 'bad' ? '#fdecea' : tone === 'warn' ? '#fff6e5' : tone === 'good' ? '#e8f8ee' : '#fffaf3'
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = tone === 'bad' ? '#8d2e24' : tone === 'warn' ? '#8a5a12' : tone === 'neutral' ? '#3d4a44' : '#14643a'
  ctx.font = `600 15px ${FONT}`
  ctx.fillText(title, x, top + (detail ? 15 : height / 2))
  if (detail) {
    ctx.font = `500 12px ${FONT}`
    ctx.fillText(detail, x, top + 31)
  }
  ctx.restore()
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + width, y, x + width, y + height, radius)
  ctx.arcTo(x + width, y + height, x, y + height, radius)
  ctx.arcTo(x, y + height, x, y, radius)
  ctx.arcTo(x, y, x + width, y, radius)
  ctx.closePath()
}

export function drawWorld(input: {
  ctx: CanvasRenderingContext2D
  game: GameState
  theme: ThemeName
  time: number
  hover: { q: number; r: number } | null
  preview: PlacementEffects | null
  scales: Map<string, number>
  particles: Particle[]
  floaters: Floater[]
  selectedKey: string | null
  wildcard: boolean
}): void {
  const { ctx, game, theme, time, hover, preview, scales, particles, floaters, selectedKey, wildcard } = input
  const occupied = new Map(game.tiles.map((tile) => [hexKey(tile.q, tile.r), tile]))
  const radius = HEX_SIZE * 0.92
  ctx.lineWidth = 1.5
  for (const tile of game.tiles) {
    if (tile.condition === 'crater') continue
    for (const neighbor of neighborsOf(tile.q, tile.r)) {
      const key = hexKey(neighbor.q, neighbor.r)
      if (occupied.has(key)) continue
      const point = hexToPixel(neighbor.q, neighbor.r)
      const hot = hover?.q === neighbor.q && hover.r === neighbor.r
      ctx.save()
      ctx.translate(point.x, point.y)
      traceHex(ctx, radius)
      ctx.strokeStyle = hot
        ? theme === 'night'
          ? 'rgba(232,240,234,0.7)'
          : 'rgba(28,40,34,0.45)'
        : theme === 'night'
          ? 'rgba(232,240,234,0.16)'
          : 'rgba(28,40,34,0.14)'
      ctx.stroke()
      ctx.restore()
    }
  }

  const biome = currentBiome(game)
  if (biome === 'meadow') {
    for (const tile of game.tiles) {
      if (tile.condition !== 'fertileAsh' && tile.condition !== 'swamp') continue
      const point = hexToPixel(tile.q, tile.r)
      ctx.save()
      ctx.translate(point.x, point.y)
      traceHex(ctx, radius + 3)
      ctx.setLineDash([4, 4])
      ctx.strokeStyle = '#c4a43a'
      ctx.lineWidth = 1.6
      ctx.stroke()
      ctx.restore()
    }
  }

  const ordered = game.tiles.slice().sort((a, b) => a.r - b.r || a.q - b.q)
  for (const tile of ordered) drawTile(ctx, tile, scales.get(hexKey(tile.q, tile.r)) ?? 1, time, theme)

  for (const particle of particles) drawParticle(ctx, particle)

  if (selectedKey) {
    const tile = occupied.get(selectedKey)
    if (tile) {
      const point = hexToPixel(tile.q, tile.r)
      ctx.save()
      ctx.translate(point.x, point.y)
      traceHex(ctx, radius + 4)
      ctx.strokeStyle = '#fffaf3'
      ctx.lineWidth = 3
      ctx.stroke()
      ctx.restore()
    }
  }

  if (!wildcard && hover && preview && !QUIET_REASONS.has(preview.reason ?? '')) {
    const point = hexToPixel(hover.q, hover.r)
    const ghost = biome ? BIOME_INFO[biome] : null
    ctx.save()
    ctx.translate(point.x, point.y)
    const pulse = 0.96 + Math.sin(time * 5) * 0.03
    ctx.scale(pulse, pulse)
    traceHex(ctx, radius)
    ctx.fillStyle = preview.valid && ghost ? ghost.glow : 'rgba(212, 94, 78, 0.35)'
    ctx.globalAlpha = preview.valid ? 0.55 : 0.4
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.setLineDash([5, 4])
    ctx.strokeStyle = preview.tone === 'bad' ? '#a33b32' : 'rgba(255,255,255,0.9)'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.restore()
    if (preview.banner) drawLabel(ctx, point.x, point.y - radius - 10, preview.banner, preview.detail, preview.tone)
  }

  for (const floater of floaters) {
    ctx.save()
    ctx.globalAlpha = Math.max(0, Math.min(1, floater.life))
    ctx.font = `700 18px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = floater.tone === 'bad' ? '#a33b32' : floater.tone === 'warn' ? '#a36b12' : '#1c7a45'
    ctx.fillText(floater.text, floater.x, floater.y)
    ctx.restore()
  }
}

function drawParticle(ctx: CanvasRenderingContext2D, particle: Particle): void {
  const alpha = Math.max(0, particle.life / particle.max)
  ctx.save()
  ctx.translate(particle.x, particle.y)
  ctx.rotate(particle.rot)
  ctx.globalAlpha = alpha
  if (particle.kind === 'ripple') {
    const grow = 1 - alpha
    ctx.strokeStyle = particle.color
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.arc(0, 0, particle.size * (0.35 + grow * 1.8), 0, Math.PI * 2)
    ctx.stroke()
  } else if (particle.kind === 'leaf') {
    ctx.fillStyle = particle.color
    ctx.beginPath()
    ctx.ellipse(0, 0, particle.size, particle.size * 0.55, 0, 0, Math.PI * 2)
    ctx.fill()
  } else if (particle.kind === 'firefly') {
    ctx.fillStyle = particle.color
    ctx.shadowColor = particle.color
    ctx.shadowBlur = 8
    ctx.beginPath()
    ctx.arc(0, 0, particle.size, 0, Math.PI * 2)
    ctx.fill()
  } else {
    ctx.fillStyle = particle.color
    ctx.beginPath()
    ctx.arc(0, 0, particle.size * (particle.kind === 'puff' ? 0.6 + (1 - alpha) : 1), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}
