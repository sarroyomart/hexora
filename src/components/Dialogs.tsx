import { Check, Crown, Share2, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { assessBiodiversity, seasonName } from '../game/engine'
import { ZEN_PASS_PRICE } from '../game/monetization'
import { buildShareText } from '../game/share'
import { biomePaint, SKIN_INFO } from '../game/skins'
import { BIOMES, type Biome, type GameMode, type GameState, type SkinName } from '../game/types'

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
  secondChance,
  onClose,
  onReplay,
  onSecondChance,
}: {
  open: boolean
  game: GameState
  secondChance: boolean
  onClose: () => void
  onReplay: () => void
  onSecondChance: () => Promise<boolean>
}) {
  const [copied, setCopied] = useState(false)
  const [pending, setPending] = useState(false)
  const [missed, setMissed] = useState(false)
  const [seenOpen, setSeenOpen] = useState(open)
  if (open !== seenOpen) {
    setSeenOpen(open)
    setCopied(false)
    setPending(false)
    setMissed(false)
  }
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
        {secondChance && (
          <div className="mt-4">
            <button
              type="button"
              className="flex min-h-11 w-full items-center justify-center rounded-full border border-[var(--line)] px-4 py-2 text-center text-sm disabled:opacity-60"
              disabled={pending}
              onClick={() => {
                setPending(true)
                setMissed(false)
                void onSecondChance().then((granted) => {
                  setPending(false)
                  if (!granted) setMissed(true)
                })
              }}
            >
              {pending ? 'Restoring…' : 'Restore +30% Harmony (Watch Short Video)'}
            </button>
            {missed && <p className="mt-2 text-center text-xs text-[var(--muted)]">The video closed before the reward.</p>}
          </div>
        )}
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

const SKINS: SkinName[] = ['classic', 'kyoto', 'reef']

export function ZenPassDialog({
  open,
  unlocked,
  skin,
  onClose,
  onPurchase,
  onRestore,
  onSkin,
}: {
  open: boolean
  unlocked: boolean
  skin: SkinName
  onClose: () => void
  onPurchase: () => Promise<boolean>
  onRestore: () => Promise<boolean>
  onSkin: (skin: SkinName) => void
}) {
  const [pending, setPending] = useState<'buy' | 'restore' | null>(null)
  const [note, setNote] = useState('')
  const [seenOpen, setSeenOpen] = useState(open)
  if (open !== seenOpen) {
    setSeenOpen(open)
    setPending(null)
    setNote('')
  }
  if (!open) return null

  async function buy() {
    setPending('buy')
    setNote('')
    const ok = await onPurchase()
    setPending(null)
    setNote(ok ? 'Zen Pass is unlocked on this device.' : 'The purchase did not finish.')
  }

  async function restore() {
    setPending('restore')
    setNote('')
    const ok = await onRestore()
    setPending(null)
    setNote(ok ? 'Zen Pass restored.' : 'No purchase found on this device.')
  }

  return (
    <Scrim onClose={onClose} label="Hexora Zen Pass">
      <div className="w-[min(28rem,calc(100vw-2rem))] p-5 sm:p-7">
        <Header title="Hexora Zen Pass" onClose={onClose} />
        <p className="mt-2 flex items-center gap-2 text-sm text-[var(--muted)]">
          <Crown size={16} />
          {ZEN_PASS_PRICE} once. Ads step aside, and two palettes join the land.
        </p>
        <ul className="mt-4 space-y-2 text-sm">
          <li>Removes every ad, including the second-chance video.</li>
          <li>Kyoto Autumn and Deep Coral Reef recolor the board. The rules stay the same.</li>
        </ul>
        <div className="mt-5 grid gap-2">
          {SKINS.map((id) => {
            const info = SKIN_INFO[id]
            const locked = id !== 'classic' && !unlocked
            const active = skin === id
            return (
              <button
                key={id}
                type="button"
                className="flex items-center gap-3 rounded-2xl border px-3 py-2 text-left disabled:opacity-70"
                style={{ borderColor: active ? 'var(--accent)' : 'var(--line)' }}
                disabled={locked || pending !== null}
                onClick={() => onSkin(id)}
                aria-pressed={active}
              >
                <span className="flex shrink-0">
                  {BIOMES.map((biome) => (
                    <Swatch key={biome} biome={biome} skin={id} />
                  ))}
                </span>
                <span>
                  <span className="block text-sm font-medium">{info.name}</span>
                  <span className="block text-xs text-[var(--muted)]">{locked ? 'Included with the pass' : info.note}</span>
                </span>
              </button>
            )
          })}
        </div>
        {!unlocked && (
          <div className="mt-5 flex flex-col gap-2">
            <button
              type="button"
              className="h-11 rounded-full bg-[var(--accent)] text-sm text-[var(--accent-ink)] disabled:opacity-60"
              disabled={pending !== null}
              onClick={() => void buy()}
            >
              {pending === 'buy' ? 'Unlocking…' : `Unlock for ${ZEN_PASS_PRICE}`}
            </button>
            <button
              type="button"
              className="h-11 rounded-full border border-[var(--line)] text-sm disabled:opacity-60"
              disabled={pending !== null}
              onClick={() => void restore()}
            >
              {pending === 'restore' ? 'Checking…' : 'Restore purchase'}
            </button>
            <p className="text-center text-xs text-[var(--muted)]">Preview unlock. No charge until the store is connected.</p>
          </div>
        )}
        {note && <p className="mt-3 text-sm text-[var(--muted)]">{note}</p>}
      </div>
    </Scrim>
  )
}

function Swatch({ biome, skin }: { biome: Biome; skin: SkinName }) {
  const paint = biomePaint(skin, biome)
  return (
    <span
      className="hex-clip -ms-1 h-7 w-7 first:ms-0"
      style={{ background: `linear-gradient(180deg, ${paint.face[0]}, ${paint.face[1]})` }}
      aria-hidden
    />
  )
}

function Scrim({ children, onClose, label }: { children: ReactNode; onClose: () => void; label: string }) {
  return (
    <div
      className="fixed inset-0 z-40 overflow-y-auto bg-[rgba(20,24,20,0.46)] pt-[max(1rem,env(safe-area-inset-top))] pe-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] ps-[max(1rem,env(safe-area-inset-left))] backdrop-blur-[2px]"
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
