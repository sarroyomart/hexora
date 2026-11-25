import { Check, Share2, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { assessBiodiversity, seasonName } from '../game/engine'
import { buildShareText } from '../game/share'
import type { GameMode, GameState } from '../game/types'

export function RulesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return (
    <Scrim onClose={onClose} label="Quick rules">
      <div className="w-[min(40rem,calc(100vw-2rem))] p-5 sm:p-7">
        <Header title="How the land answers" onClose={onClose} />
        <p className="mt-2 text-sm text-[var(--muted)]">
          The Ancient Seed counts as both grove and spring for its neighbors. Place each offered biome on an open hex touching the living land. Only a meadow can root in fertile ash or swamp.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {RULES.map((rule) => (
            <article key={rule.title} className="rounded-2xl border border-[var(--line)] p-4" style={{ background: rule.wash }}>
              <p className="text-[10px] tracking-[0.18em] uppercase" style={{ color: rule.ink }}>
                {rule.kicker}
              </p>
              <h3 className="mt-1 text-lg font-medium" style={{ color: rule.ink }}>
                {rule.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: rule.ink }}>
                {rule.body}
              </p>
            </article>
          ))}
        </div>
        <p className="mt-5 text-sm leading-relaxed text-[var(--muted)]">
          Drag to move the land. Scroll or pinch to zoom. Double-click, or press 0, to recenter. Sound is synthesized in the browser. Zen runs until harmony fails. Daily Hexora deals the same 40 tiles from the date.
        </p>
      </div>
    </Scrim>
  )
}

const RULES = [
  {
    kicker: 'Spring',
    title: 'Water',
    wash: '#e5f7fb',
    ink: '#0e5c6b',
    body: '+2 for each neighboring grove or meadow. Three connected springs become a river for +5. A spring with five water neighbors floods into swamp. A grove beside that swamp drains it.',
  },
  {
    kicker: 'Grove',
    title: 'Forest',
    wash: '#e5f6ea',
    ink: '#0d3d24',
    body: '+2 for each spring and +1 for each creature. Six or more groves that touch neither a spring nor the Ancient Seed enter drought. Without water on the next turn, three burn into fertile ash.',
  },
  {
    kicker: 'Flora',
    title: 'Meadow',
    wash: '#f7f6d8',
    ink: '#5c4a12',
    body: '+1, plus +1 for every different biome it touches, up to +5. It is the only tile that can be planted on fertile ash, where that score doubles, or on swamp, which it restores.',
  },
  {
    kicker: 'Stone',
    title: 'Mountain',
    wash: '#eeeaf6',
    ink: '#3a3650',
    body: 'Doubles the synergy of neighboring springs and fauna. A peak may touch at most two other peaks. Four connected peaks landslide, and the heart of the range collapses into a crater.',
  },
  {
    kicker: 'Wildlife',
    title: 'Fauna',
    wash: '#fde8e1',
    ink: '#6e2e22',
    body: '+4 in a complete ecosystem: water, forest, and meadow at once. A neighboring peak doubles it. With neither water nor forest, it fades for two turns, then vanishes for −3.',
  },
  {
    kicker: 'Seasons',
    title: 'Harmony',
    wash: '#f8f1e4',
    ink: '#3d3428',
    body: 'You begin full. Synergies mend harmony by 2–5%. Flood, wildfire, landslide, and extinction crack it by 15–25%. At 0% the mosaic ends. Scores of 100, 250, 500, 1000 and beyond turn the season and grant a restoration wildcard.',
  },
]

export function SummaryDialog({
  open,
  game,
  onClose,
  onReplay,
}: {
  open: boolean
  game: GameState
  onClose: () => void
  onReplay: () => void
}) {
  const [copied, setCopied] = useState(false)
  if (!open) return null
  const bio = assessBiodiversity(game.tiles)
  const share = buildShareText(game)
  const heading = game.gameOver ? 'The land fell quiet' : game.mode === 'daily' ? 'The day holds' : 'This mosaic rests'

  async function copy() {
    try {
      await navigator.clipboard.writeText(share)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <Scrim onClose={onClose} label="Result">
      <div className="w-[min(28rem,calc(100vw-2rem))] p-5 sm:p-7">
        <Header title={heading} onClose={onClose} />
        <p className="mt-1 text-sm text-[var(--muted)]">
          {seasonName(game.season)}
          {game.mode === 'daily' ? ` · Hexora Daily #${game.dailyNumber}` : ' · Zen'}
        </p>
        <div className="mt-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] tracking-[0.16em] text-[var(--muted)] uppercase">Score</p>
            <p className="text-5xl font-medium tabular-nums">{game.score}</p>
          </div>
          <div className="text-right">
            <p className="text-5xl font-medium">{bio.grade}</p>
            <p className="text-sm text-[var(--muted)]">{bio.label}</p>
          </div>
        </div>
        <p className="mt-3 text-sm text-[var(--muted)]">Harmony {Math.round(game.harmony)}% · {game.placedCount} tiles</p>
        <pre className="selectable mt-4 max-h-48 overflow-auto rounded-2xl bg-[var(--track)] p-3 text-sm leading-relaxed whitespace-pre-wrap">
          {share}
        </pre>
        <div className="mt-4 flex flex-wrap gap-2">
          {game.mode === 'daily' && (
            <button type="button" className="inline-flex h-11 items-center gap-2 rounded-full bg-[var(--accent)] px-4 text-sm text-[var(--accent-ink)]" onClick={() => void copy()}>
              {copied ? <Check size={16} /> : <Share2 size={16} />}
              {copied ? 'Copied' : 'Share result'}
            </button>
          )}
          <button type="button" className="h-11 rounded-full border border-[var(--line)] px-4 text-sm" onClick={onReplay}>
            {game.mode === 'daily' ? 'Replay today' : 'New mosaic'}
          </button>
        </div>
      </div>
    </Scrim>
  )
}

export function ConfirmDialog({
  open,
  mode,
  onClose,
  onConfirm,
}: {
  open: boolean
  mode: GameMode
  onClose: () => void
  onConfirm: () => void
}) {
  if (!open) return null
  return (
    <Scrim onClose={onClose} label="Start over">
      <div className="w-[min(24rem,calc(100vw-2rem))] p-5">
        <Header title={mode === 'daily' ? 'Replay today?' : 'Begin a fresh mosaic?'} onClose={onClose} />
        <p className="mt-2 text-sm text-[var(--muted)]">
          {mode === 'daily'
            ? 'The tile order stays the same for everyone on this date. Your best score is already kept.'
            : 'This run ends. Your best score stays in the ledger.'}
        </p>
        <div className="mt-5 flex gap-2">
          <button type="button" className="h-11 flex-1 rounded-full bg-[var(--accent)] text-sm text-[var(--accent-ink)]" onClick={onConfirm}>
            {mode === 'daily' ? 'Replay' : 'Start fresh'}
          </button>
          <button type="button" className="h-11 flex-1 rounded-full border border-[var(--line)] text-sm" onClick={onClose}>
            Keep playing
          </button>
        </div>
      </div>
    </Scrim>
  )
}

function Scrim({ children, onClose, label }: { children: ReactNode; onClose: () => void; label: string }) {
  return (
    <div
      className="fixed inset-0 z-40 overflow-y-auto bg-[rgba(20,24,20,0.46)] p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={onClose}
    >
      <div className="flex min-h-full items-center justify-center">
        <div className="glass w-fit max-w-full rounded-3xl" onClick={(event) => event.stopPropagation()}>
          {children}
        </div>
      </div>
    </div>
  )
}

function Header({ title, onClose }: { title: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="flex items-start justify-between gap-3">
      <h2 className="text-2xl font-medium tracking-tight">{title}</h2>
      <button type="button" className="grid h-9 w-9 place-items-center rounded-full border border-[var(--line)]" aria-label="Close" onClick={onClose}>
        <X size={16} />
      </button>
    </div>
  )
}
