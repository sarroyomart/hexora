export interface Axial {
  q: number
  r: number
}

/** Pointy-top axial neighbors, starting at the east and walking counter-clockwise. */
export const HEX_DIRS: readonly Axial[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
]

export const HEX_SIZE = 46

export function hexKey(q: number, r: number): string {
  return `${q},${r}`
}

export function parseHexKey(key: string): Axial {
  const comma = key.indexOf(',')
  return {
    q: Number(key.slice(0, comma)),
    r: Number(key.slice(comma + 1)),
  }
}

export function neighborsOf(q: number, r: number): Axial[] {
  return HEX_DIRS.map((dir) => ({ q: q + dir.q, r: r + dir.r }))
}

/** Cube distance on the axial plane. Integer coordinates stay exact. */
export function hexDistance(a: Axial, b: Axial): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2
}

const SQRT3 = Math.sqrt(3)

export function hexToPixel(q: number, r: number, size = HEX_SIZE): { x: number; y: number } {
  return {
    x: size * (SQRT3 * q + (SQRT3 / 2) * r),
    y: size * (3 / 2) * r,
  }
}

/**
 * Fractional axial → nearest hex.
 * The cube-coordinate tie break avoids the rounding bugs of rounding q and r independently.
 */
export function hexRound(q: number, r: number): Axial {
  const s = -q - r
  let rq = Math.round(q)
  let rr = Math.round(r)
  let rs = Math.round(s)
  const qDiff = Math.abs(rq - q)
  const rDiff = Math.abs(rr - r)
  const sDiff = Math.abs(rs - s)

  if (qDiff > rDiff && qDiff > sDiff) rq = -rr - rs
  else if (rDiff > sDiff) rr = -rq - rs
  else rs = -rq - rr

  return { q: rq, r: rr }
}

export function pixelToHex(x: number, y: number, size = HEX_SIZE): Axial {
  const q = ((SQRT3 / 3) * x - (1 / 3) * y) / size
  const r = ((2 / 3) * y) / size
  return hexRound(q, r)
}

export function hexPolygon(ctx: CanvasRenderingContext2D, radius: number): void {
  ctx.beginPath()
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30)
    const x = radius * Math.cos(angle)
    const y = radius * Math.sin(angle)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
}
