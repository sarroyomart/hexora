import { useEffect, useLayoutEffect, useRef } from 'react'
import type { PlacementEffects } from '../game/engine'
import { previewPlacement } from '../game/engine'
import { hapticLight } from '../game/haptics'
import { HEX_SIZE, hexKey, hexToPixel, pixelToHex } from '../game/hexMath'
import { drawBackground, drawWorld, type Floater, type Particle } from '../game/render'
import type { GameState, SkinName, ThemeName } from '../game/types'

interface Spring {
  scale: number
  v: number
  sig: string
}

interface Props {
  game: GameState
  theme: ThemeName
  skin: SkinName
  season: number
  wildcard: boolean
  selectedKey: string | null
  pulse: number
  effects: PlacementEffects | null
  inputLocked: boolean
  onPlace: (q: number, r: number) => void
  onSelect: (q: number, r: number) => void
}

export function GameCanvas({
  game,
  theme,
  skin,
  season,
  wildcard,
  selectedKey,
  pulse,
  effects,
  inputLocked,
  onPlace,
  onSelect,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const propsRef = useRef({ game, theme, skin, season, wildcard, selectedKey, inputLocked, onPlace, onSelect })
  useLayoutEffect(() => {
    propsRef.current = { game, theme, skin, season, wildcard, selectedKey, inputLocked, onPlace, onSelect }
  }, [game, theme, skin, season, wildcard, selectedKey, inputLocked, onPlace, onSelect])
  const seenPulse = useRef(0)
  const fx = useRef({
    particles: [] as Particle[],
    floaters: [] as Floater[],
    springs: new Map<string, Spring>(),
    shake: 0,
    primed: false,
  })

  useEffect(() => {
    if (pulse === 0 || seenPulse.current === pulse || !effects) return
    seenPulse.current = pulse
    const bucket = fx.current
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    bucket.shake = reducedMotion ? 0 : effects.imbalances.length > 0 ? 7 : effects.surge ? 3.6 : 0
    if (effects.surge && effects.focus && !reducedMotion) {
      surgeBurst(bucket.particles, hexToPixel(effects.focus.q, effects.focus.r))
    }
    const stacked = new Map<string, number>()
    for (const note of effects.floaters) {
      const key = `${note.q},${note.r}`
      const index = stacked.get(key) ?? 0
      stacked.set(key, index + 1)
      const point = hexToPixel(note.q, note.r)
      bucket.floaters.push({
        x: point.x + index * 16,
        y: point.y - HEX_SIZE * 0.9 - index * 10,
        text: note.text,
        tone: note.tone,
        life: note.text.length > 16 ? 1.8 : 1.2,
      })
    }
    if (bucket.floaters.length > 24) bucket.floaters.splice(0, bucket.floaters.length - 24)
  }, [pulse, effects])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const cam = { x: 0, y: -36, zoom: 1 }
    let width = 1
    let height = 1
    let dpr = 1
    let hover: { q: number; r: number } | null = null
    let preview: PlacementEffects | null = null
    let previewKey = ''
    let shownSeason = propsRef.current.season
    let fitted = false
    const pointers = new Map<number, { x: number; y: number; sx: number; sy: number }>()
    const tapSlop = 10
    let moved = false
    let hoverKey = ''
    let pinch: { dist: number; zoom: number; worldX: number; worldY: number } | null = null
    let running = true
    let last = performance.now()
    let raf = 0

    const localPoint = (event: PointerEvent | MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      return { x: event.clientX - rect.left, y: event.clientY - rect.top }
    }

    const screenToWorld = (x: number, y: number) => ({
      x: (x - width / 2 - cam.x) / cam.zoom,
      y: (y - height / 2 - cam.y) / cam.zoom,
    })

    const zoomAt = (x: number, y: number, next: number) => {
      const world = screenToWorld(x, y)
      cam.zoom = Math.min(2.35, Math.max(0.42, next))
      cam.x = x - width / 2 - world.x * cam.zoom
      cam.y = y - height / 2 - world.y * cam.zoom
    }

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      width = Math.max(1, rect.width)
      height = Math.max(1, rect.height)
      dpr = Math.min(window.devicePixelRatio || 1, 2.5)
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      if (!fitted) {
        cam.zoom = width < 720 ? 0.78 : 1
        fitted = true
      }
    }

    const setHover = (x: number, y: number) => {
      const world = screenToWorld(x, y)
      const next = pixelToHex(world.x, world.y)
      hover = next
      const key = `${next.q},${next.r}`
      if (key === hoverKey) return
      hoverKey = key
      const current = propsRef.current
      if (current.inputLocked || moved || pinch) return
      if (current.wildcard) {
        const tile = current.game.tiles.find((item) => item.q === next.q && item.r === next.r)
        if (tile && tile.kind !== 'core') hapticLight()
        return
      }
      if (previewPlacement(current.game, next.q, next.r).valid) hapticLight()
    }

    const onDown = (event: PointerEvent) => {
      if (propsRef.current.inputLocked) return
      canvas.setPointerCapture(event.pointerId)
      const point = localPoint(event)
      pointers.set(event.pointerId, { ...point, sx: point.x, sy: point.y })
      if (pointers.size >= 2) {
        const [a, b] = [...pointers.values()]
        const dist = Math.hypot((a?.x ?? 0) - (b?.x ?? 0), (a?.y ?? 0) - (b?.y ?? 0))
        const midX = ((a?.x ?? 0) + (b?.x ?? 0)) / 2
        const midY = ((a?.y ?? 0) + (b?.y ?? 0)) / 2
        const anchor = screenToWorld(midX, midY)
        pinch = { dist: Math.max(1, dist), zoom: cam.zoom, worldX: anchor.x, worldY: anchor.y }
        moved = true
      }
      setHover(point.x, point.y)
    }

    const onMove = (event: PointerEvent) => {
      const point = localPoint(event)
      const previous = pointers.get(event.pointerId)
      if (previous && !propsRef.current.inputLocked) {
        pointers.set(event.pointerId, { ...previous, x: point.x, y: point.y })
        if (pointers.size >= 2 && pinch) {
          const [a, b] = [...pointers.values()]
          const dist = Math.hypot((a?.x ?? 0) - (b?.x ?? 0), (a?.y ?? 0) - (b?.y ?? 0))
          const midX = ((a?.x ?? 0) + (b?.x ?? 0)) / 2
          const midY = ((a?.y ?? 0) + (b?.y ?? 0)) / 2
          cam.zoom = Math.min(2.35, Math.max(0.42, pinch.zoom * (dist / pinch.dist)))
          cam.x = midX - width / 2 - pinch.worldX * cam.zoom
          cam.y = midY - height / 2 - pinch.worldY * cam.zoom
          canvas.style.cursor = 'grabbing'
          moved = true
          return
        }
        if (Math.hypot(point.x - previous.sx, point.y - previous.sy) > tapSlop) moved = true
        if (moved) {
          cam.x += point.x - previous.x
          cam.y += point.y - previous.y
          canvas.style.cursor = 'grabbing'
        }
      }
      setHover(point.x, point.y)
    }

    const finishPointer = (event: PointerEvent, place: boolean) => {
      const point = localPoint(event)
      pointers.delete(event.pointerId)
      if (pointers.size < 2) pinch = null
      if (pointers.size === 0) {
        if (place && !moved && !propsRef.current.inputLocked) {
          const world = screenToWorld(point.x, point.y)
          const axial = pixelToHex(world.x, world.y)
          const { wildcard: armed, onPlace: drop, onSelect: select } = propsRef.current
          if (armed) select(axial.q, axial.r)
          else drop(axial.q, axial.r)
        }
        moved = false
        canvas.style.cursor = 'grab'
      }
      setHover(point.x, point.y)
    }

    const onUp = (event: PointerEvent) => finishPointer(event, true)
    const onCancel = (event: PointerEvent) => finishPointer(event, false)
    const onMenu = (event: Event) => event.preventDefault()

    const onWheel = (event: WheelEvent) => {
      if (propsRef.current.inputLocked) return
      event.preventDefault()
      const point = localPoint(event)
      zoomAt(point.x, point.y, cam.zoom * Math.exp(-event.deltaY * 0.0011))
    }

    const onLeave = () => {
      if (pointers.size === 0) {
        hover = null
        hoverKey = ''
      }
    }

    const onDouble = () => {
      cam.x = 0
      cam.y = -36
      cam.zoom = width < 720 ? 0.78 : 1
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
      if (event.key === '0' || event.key === 'Home') onDouble()
      if (event.key === '+' || event.key === '=') zoomAt(width / 2, height / 2, cam.zoom * 1.08)
      if (event.key === '-' || event.key === '_') zoomAt(width / 2, height / 2, cam.zoom / 1.08)
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onCancel)
    canvas.addEventListener('contextmenu', onMenu)
    canvas.addEventListener('pointerleave', onLeave)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('dblclick', onDouble)
    window.addEventListener('keydown', onKey)

    const frame = (now: number) => {
      if (!running) return
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const current = propsRef.current
      const bucket = fx.current
      let seasonGap = current.season - shownSeason
      if (seasonGap > 2) seasonGap -= 4
      if (seasonGap < -2) seasonGap += 4
      shownSeason += seasonGap * (reduced ? 1 : 0.04)
      if (shownSeason < 0) shownSeason += 4
      if (shownSeason >= 4) shownSeason -= 4

      const live = new Set<string>()
      for (const tile of current.game.tiles) {
        const key = hexKey(tile.q, tile.r)
        live.add(key)
        const sig = `${tile.kind}:${tile.condition}:${tile.placedTurn}`
        let spring = bucket.springs.get(key)
        if (!bucket.primed) {
          bucket.springs.set(key, { scale: 1, v: 0, sig })
          continue
        }
        if (!spring) {
          spring = { scale: reduced ? 1 : 0.28, v: 0, sig }
          bucket.springs.set(key, spring)
          burst(bucket.particles, hexToPixel(tile.q, tile.r), reduced)
        } else if (spring.sig !== sig) {
          spring.sig = sig
          if (!reduced) {
            spring.scale = 0.72
            spring.v = 0.08
          }
        }
        if (!reduced && spring.scale !== 1) {
          spring.v += (1 - spring.scale) * 0.18
          spring.v *= 0.7
          spring.scale += spring.v
          if (Math.abs(spring.scale - 1) < 0.004 && Math.abs(spring.v) < 0.004) {
            spring.scale = 1
            spring.v = 0
          }
        }
      }
      bucket.primed = true
      for (const key of [...bucket.springs.keys()]) {
        if (!live.has(key)) {
          bucket.springs.delete(key)
          const [q, r] = key.split(',').map(Number)
          burst(bucket.particles, hexToPixel(q ?? 0, r ?? 0), reduced)
        }
      }

      if (!reduced) spawnAmbient(current.game, bucket.particles)
      stepParticles(bucket.particles, dt)
      for (let i = bucket.floaters.length - 1; i >= 0; i--) {
        const floater = bucket.floaters[i]
        if (!floater) continue
        floater.life -= dt * 0.45
        floater.y -= 20 * dt
        if (floater.life <= 0) bucket.floaters.splice(i, 1)
      }
      bucket.shake *= reduced ? 0 : 0.9

      if (hover && !current.wildcard && !current.inputLocked) {
        const id = `${hover.q},${hover.r},${current.game.turn},${current.game.index},${current.game.score},${current.game.harmony}`
        if (id !== previewKey) {
          preview = previewPlacement(current.game, hover.q, hover.r)
          previewKey = id
          canvas.style.cursor = preview.valid || preview.reason === 'Too many peaks' ? 'pointer' : 'grab'
        }
      } else if (!hover) {
        preview = null
        previewKey = ''
      }

      let maxX = 240
      let maxY = 240
      for (const tile of current.game.tiles) {
        const point = hexToPixel(tile.q, tile.r)
        maxX = Math.max(maxX, Math.abs(point.x) + 220)
        maxY = Math.max(maxY, Math.abs(point.y) + 220)
      }
      const limitX = maxX * cam.zoom
      const limitY = maxY * cam.zoom
      cam.x = Math.min(limitX, Math.max(-limitX, cam.x))
      cam.y = Math.min(limitY, Math.max(-limitY, cam.y))

      const shakeX = Math.sin(now * 0.04) * bucket.shake
      const shakeY = Math.cos(now * 0.033) * bucket.shake
      const scales = new Map<string, number>()
      for (const [key, spring] of bucket.springs) scales.set(key, spring.scale)

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      drawBackground(ctx, width, height, current.theme, current.skin, shownSeason, now / 1000)
      ctx.setTransform(
        dpr * cam.zoom,
        0,
        0,
        dpr * cam.zoom,
        (width / 2 + cam.x + shakeX) * dpr,
        (height / 2 + cam.y + shakeY) * dpr,
      )
      drawWorld({
        ctx,
        game: current.game,
        theme: current.theme,
        skin: current.skin,
        time: now / 1000,
        hover,
        preview,
        scales,
        particles: bucket.particles,
        floaters: bucket.floaters,
        selectedKey: current.selectedKey,
        wildcard: current.wildcard,
      })
      raf = requestAnimationFrame(frame)
    }

    raf = requestAnimationFrame(frame)
    return () => {
      running = false
      cancelAnimationFrame(raf)
      observer.disconnect()
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onCancel)
      canvas.removeEventListener('contextmenu', onMenu)
      canvas.removeEventListener('pointerleave', onLeave)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('dblclick', onDouble)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none" aria-label="Hexora board" />
}

function surgeBurst(particles: Particle[], point: { x: number; y: number }): void {
  for (let i = 0; i < 16; i++) {
    const angle = (Math.PI * 2 * i) / 16
    const gold = i % 2 === 0 ? '#f2d48a' : '#fff6d8'
    particles.push({
      x: point.x,
      y: point.y,
      vx: Math.cos(angle) * (36 + (i % 4) * 8),
      vy: Math.sin(angle) * (36 + (i % 4) * 8) - 10,
      life: 0.85,
      max: 0.85,
      kind: i % 3 === 0 ? 'firefly' : 'puff',
      rot: angle,
      spin: 2,
      size: i % 3 === 0 ? 2.4 : 3.4,
      color: gold,
    })
  }
}

function burst(particles: Particle[], point: { x: number; y: number }, reduced: boolean): void {
  if (reduced) return
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI * 2 * i) / 8
    particles.push({
      x: point.x,
      y: point.y,
      vx: Math.cos(angle) * 28,
      vy: Math.sin(angle) * 28,
      life: 0.6,
      max: 0.6,
      kind: 'puff',
      rot: 0,
      spin: 0,
      size: 3,
      color: 'rgba(255,255,255,0.8)',
    })
  }
}

function spawnAmbient(game: GameState, particles: Particle[]): void {
  if (particles.length > 130) return
  for (const tile of game.tiles) {
    const point = hexToPixel(tile.q, tile.r)
    const roll = Math.random()
    if ((tile.kind === 'forest' || tile.condition === 'drought') && roll < 0.008) {
      particles.push({
        x: point.x + (Math.random() - 0.5) * 20,
        y: point.y - 10,
        vx: -6 + Math.random() * 8,
        vy: 10 + Math.random() * 12,
        life: 2.4,
        max: 2.4,
        kind: 'leaf',
        rot: Math.random() * 3,
        spin: 1.4,
        size: 3.2,
        color: tile.condition === 'drought' ? '#e2b56a' : '#2f8a4e',
      })
    } else if (tile.kind === 'fauna' && roll < 0.02) {
      particles.push({
        x: point.x + (Math.random() - 0.5) * 26,
        y: point.y + (Math.random() - 0.5) * 26,
        vx: (Math.random() - 0.5) * 10,
        vy: -8 - Math.random() * 8,
        life: 1.8,
        max: 1.8,
        kind: 'firefly',
        rot: 0,
        spin: 0,
        size: 1.8,
        color: '#ffe08a',
      })
    } else if (tile.kind === 'water' && tile.condition !== 'swamp' && roll < 0.01) {
      particles.push({
        x: point.x,
        y: point.y,
        vx: 0,
        vy: 0,
        life: 1.4,
        max: 1.4,
        kind: 'ripple',
        rot: 0,
        spin: 0,
        size: 10,
        color: 'rgba(255,255,255,0.75)',
      })
    } else if (tile.kind === 'meadow' && roll < 0.008) {
      particles.push({
        x: point.x,
        y: point.y,
        vx: (Math.random() - 0.5) * 8,
        vy: -12,
        life: 1.6,
        max: 1.6,
        kind: 'pollen',
        rot: 0,
        spin: 0,
        size: 1.6,
        color: '#f2e394',
      })
    } else if (tile.condition === 'fertileAsh' && roll < 0.02) {
      particles.push({
        x: point.x,
        y: point.y,
        vx: (Math.random() - 0.5) * 6,
        vy: -16,
        life: 1.1,
        max: 1.1,
        kind: 'ember',
        rot: 0,
        spin: 0,
        size: 1.7,
        color: '#e6c27a',
      })
    }
  }
}

function stepParticles(particles: Particle[], dt: number): void {
  for (let i = particles.length - 1; i >= 0; i--) {
    const particle = particles[i]
    if (!particle) continue
    particle.life -= dt
    particle.x += particle.vx * dt
    particle.y += particle.vy * dt
    particle.rot += particle.spin * dt
    if (particle.kind === 'leaf') particle.vy += 8 * dt
    if (particle.life <= 0) particles.splice(i, 1)
  }
}
