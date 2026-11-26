import { useEffect, useState, type ReactNode } from 'react'
import {
  BookOpen,
  CalendarDays,
  CircleHelp,
  Crown,
  Droplets,
  Flame,
  Flower2,
  Infinity as InfinityIcon,
  Moon,
  Mountain,
  Palette,
  PawPrint,
  RotateCcw,
  Sparkles,
  Sprout,
  Sun,
  TreePine,
  Volume2,
  VolumeX,
  type LucideIcon,
} from 'lucide-react'
import { assessBiodiversity, currentBiome, seasonName, upcomingBiomes, type PlacementEffects } from '../game/engine'
import { biomePaint } from '../game/skins'
import { visibleStreak } from '../game/storage'
import { todayString } from '../game/seededRandom'
import { BIOME_INFO, BIOMES, DAILY_LENGTH, type Biome, type GameState, type Settings, type SkinName, type Stats, type Tile } from '../game/types'

const ICONS: Record<Biome, LucideIcon> = {
  water: Droplets,
  forest: TreePine,
  meadow: Flower2,
  mountain: Mountain,
  fauna: PawPrint,
}

export interface ToastItem {
  id: number
  text: string
  tone: 'good' | 'bad' | 'warn'
}

interface Props {
  game: GameState
  stats: Stats
  settings: Settings
  skin: SkinName
  zenPass: boolean
  status: string
  wildcardOn: boolean
  target: Tile | null
  toasts: ToastItem[]
  effects: PlacementEffects | null
  pulse: number
  onToggleMute: () => void
  onToggleTheme: () => void
  onMode: (mode: GameState['mode']) => void
  onRules: () => void
  onReset: () => void
  onResults: () => void
  onToggleWildcard: () => void
  onWildcard: (action: { type: 'clear'; q: number; r: number } | { type: 'transform'; q: number; r: number; biome: Biome }) => void
  onCancelTarget: () => void
  onDismissHint: () => void
  onZenPass: () => void
  onAtlas: () => void
}

export function HUD(props: Props) {
  const {
    game,
    stats,
    settings,
    skin,
    zenPass,
    status,
    wildcardOn,
    target,
    toasts,
    effects,
    pulse,
    onToggleMute,
    onToggleTheme,
    onMode,
    onRules,
    onReset,
    onResults,
    onToggleWildcard,
    onWildcard,
    onCancelTarget,
    onDismissHint,
    onZenPass,
    onAtlas,
  } = props
  const current = currentBiome(game)
  const upcoming = upcomingBiomes(game)
  const bio = assessBiodiversity(game.tiles)
  const best = game.mode === 'infinite' ? stats.infiniteBest : (stats.dailyByDate[game.date]?.score ?? 0)
  const streak = visibleStreak(stats, todayString())
  const ended = game.gameOver || game.victory
  const harmony = Math.round(game.harmony)
  const delta = useScoreDelta(effects, pulse)

  return (
    <>
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col gap-2 ps-[max(0.75rem,env(safe-area-inset-left))] pe-[max(0.75rem,env(safe-area-inset-right))] pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="glass pointer-events-auto flex items-center gap-3 rounded-2xl px-3 py-2">
            <span className="hex-clip grid h-9 w-9 place-items-center bg-[#1f7a45] text-[#f6e7b4]" aria-hidden>
              <Sparkles size={16} />
            </span>
            <div>
              <h1 className="text-[1.15rem] leading-none font-medium tracking-[0.34em] text-[var(--ink)]">HEXORA</h1>
              <p className="mt-1 text-[10px] tracking-[0.18em] text-[var(--muted)] uppercase">
                {seasonName(game.season)}
                {game.mode === 'daily' ? ` · #${game.dailyNumber}` : ''}
              </p>
            </div>
          </div>
          <div className="pointer-events-auto ms-auto flex justify-end gap-1">
            <IconButton label="Hexora Atlas" onClick={onAtlas}>
              <BookOpen size={18} />
            </IconButton>
            <IconButton label="Quick rules" onClick={onRules}>
              <CircleHelp size={18} />
            </IconButton>
            <IconButton label={settings.muted ? 'Unmute' : 'Mute'} onClick={onToggleMute}>
              {settings.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </IconButton>
            <IconButton label={settings.theme === 'day' ? 'Night mode' : 'Day mode'} onClick={onToggleTheme}>
              {settings.theme === 'day' ? <Moon size={18} /> : <Sun size={18} />}
            </IconButton>
            <IconButton label={zenPass ? 'Zen Pass themes' : 'Hexora Zen Pass'} onClick={onZenPass}>
              {zenPass ? <Palette size={18} /> : <Crown size={18} />}
            </IconButton>
          </div>
        </div>

        <div className={`glass pointer-events-auto flex w-full max-w-xl flex-wrap items-center gap-4 rounded-2xl px-4 py-3 ${flowChrome(game)}`}>
          <div className="min-w-16">
            <p className="text-[10px] tracking-[0.16em] text-[var(--muted)] uppercase">Score</p>
            <p className="flex items-baseline gap-2">
              <span key={game.score} className="score-pop text-3xl leading-none font-medium tabular-nums">
                {game.score}
              </span>
              {delta && (delta.gained > 0 || delta.lost > 0) && (
                <span
                  key={delta.id}
                  className="score-delta flex items-baseline gap-1 text-base font-medium tabular-nums leading-none"
                  aria-hidden
                >
                  {delta.gained > 0 && <span className="text-[var(--good)]">+{delta.gained}</span>}
                  {delta.lost > 0 && <span className="text-[var(--bad)]">−{delta.lost}</span>}
                </span>
              )}
            </p>
          </div>
          <div className="min-w-36 flex-1">
            <div className="mb-1 flex items-center justify-between text-[10px] tracking-[0.16em] text-[var(--muted)] uppercase">
              <span className="flex items-center gap-2">
                Harmony
                {game.goldenFlow ? (
                  <span className="text-[var(--gold)]">Golden ×2</span>
                ) : game.goldenReady ? (
                  <span className="text-[var(--gold)]">Flow ready</span>
                ) : null}
              </span>
              <span className="flex items-center gap-1.5 tabular-nums">
                {harmony}%
                {delta && delta.harmony !== 0 && (
                  <span
                    key={`h-${delta.id}`}
                    className="score-delta text-[10px] font-medium"
                    style={{ color: delta.harmony > 0 ? 'var(--good)' : 'var(--bad)' }}
                    aria-hidden
                  >
                    {delta.harmony > 0 ? `+${delta.harmony}` : `−${Math.abs(delta.harmony)}`}
                  </span>
                )}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-[var(--track)]">
              <div
                className="h-full rounded-full transition-[width] duration-500 ease-out"
                style={{ width: `${harmony}%`, background: harmonyColor(harmony) }}
              />
            </div>
          </div>
          <div
            className="grid h-9 min-w-9 place-items-center rounded-full border border-[var(--line)] px-2 text-sm font-medium"
            title={game.placedCount === 0 ? 'Biodiversity appears as the land diversifies' : bio.label}
          >
            {game.placedCount === 0 ? '–' : bio.grade}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-full bg-[var(--track)] p-1" role="tablist" aria-label="Game mode">
              <ModeButton active={game.mode === 'infinite'} label="Zen" onClick={() => onMode('infinite')}>
                <InfinityIcon size={14} />
              </ModeButton>
              <ModeButton active={game.mode === 'daily'} label="Daily" onClick={() => onMode('daily')}>
                <CalendarDays size={14} />
              </ModeButton>
            </div>
            <span className="hidden items-center gap-1 text-xs text-[var(--muted)] sm:flex" title="Daily streak">
              <Flame size={14} />
              {streak}
            </span>
          </div>
        </div>
        {!ended && (
          <div className="pointer-events-none flex">
            <p className="glass pointer-events-auto inline-flex max-w-xl items-center gap-2 rounded-full px-3 py-1.5 text-sm">
              <span className="text-[10px] tracking-[0.16em] text-[var(--muted)] uppercase">Bounty</span>
              <span>{game.bounty.label}</span>
            </p>
          </div>
        )}
      </header>

      <div className="pointer-events-none absolute inset-x-0 z-30 flex flex-col items-center gap-2 px-4 top-[calc(env(safe-area-inset-top)+13.25rem)]">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="toast-in glass pointer-events-auto max-w-md rounded-full px-4 py-2 text-sm"
            style={{ color: toast.tone === 'bad' ? '#a33b32' : toast.tone === 'warn' ? '#a36b12' : 'var(--ink)' }}
          >
            {toast.text}
          </div>
        ))}
      </div>

      <footer className="pointer-events-none absolute inset-x-0 bottom-0 z-20 ps-[max(0.75rem,env(safe-area-inset-left))] pe-[max(0.75rem,env(safe-area-inset-right))] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {target && (
          <div className="glass pointer-events-auto mx-auto mb-2 w-full max-w-xl rounded-2xl p-3">
            {target.kind === 'core' ? (
              <p className="text-sm text-[var(--muted)]">The Ancient Seed is the heart of the board. It stays.</p>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm">Restore this hex</p>
                  <button type="button" className="text-xs text-[var(--muted)]" onClick={onCancelTarget}>
                    Close
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="rounded-full border border-[var(--line)] px-3 py-2 text-sm"
                    onClick={() => onWildcard({ type: 'clear', q: target.q, r: target.r })}
                  >
                    Clear
                  </button>
                  {BIOMES.map((biome) => (
                    <button
                      key={biome}
                      type="button"
                      className="rounded-xl p-1"
                      aria-label={`Transform into ${BIOME_INFO[biome].name}`}
                      onClick={() => onWildcard({ type: 'transform', q: target.q, r: target.r, biome })}
                    >
                      <BiomeToken biome={biome} skin={skin} size={42} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!settings.hintSeen && game.placedCount === 0 && !ended && (
          <div className="glass pointer-events-auto mx-auto mb-2 flex w-full max-w-xl items-start justify-between gap-3 rounded-2xl px-4 py-3 text-sm">
            <p>Lay the offered biome on an open hex. The ghost shows what the land will do before you commit.</p>
            <button type="button" className="shrink-0 text-[var(--muted)]" onClick={onDismissHint} aria-label="Dismiss hint">
              Close
            </button>
          </div>
        )}

        <div className={`glass pointer-events-auto mx-auto flex w-full max-w-xl flex-col items-center gap-3 rounded-[28px] px-4 py-3 ${flowChrome(game)}`}>
          <p className="min-h-5 text-center text-sm text-[var(--muted)]">{status}</p>
          <div className="flex items-end justify-center gap-3 sm:gap-5">
            <button
              type="button"
              className="mb-1 flex h-16 w-16 flex-col items-center justify-center rounded-2xl border border-[var(--line)] text-[10px] tracking-wide uppercase disabled:opacity-40"
              style={{ background: wildcardOn ? 'var(--accent)' : 'transparent', color: wildcardOn ? 'var(--accent-ink)' : 'var(--ink)' }}
              disabled={!wildcardOn && game.wildcards < 1}
              onClick={onToggleWildcard}
              aria-pressed={wildcardOn}
              aria-label={wildcardOn ? 'Cancel restoration' : `Restoration wildcards, ${game.wildcards} available`}
            >
              <Sparkles size={16} />
              <span className="mt-1">{wildcardOn ? 'Cancel' : game.wildcards}</span>
            </button>
            <div className="flex flex-col items-center gap-1">
              {current ? (
                <>
                  <BiomeToken biome={current} skin={skin} size={84} />
                  <span className="text-[10px] tracking-[0.18em] text-[var(--muted)] uppercase">{BIOME_INFO[current].epithet}</span>
                </>
              ) : (
                <div className="grid h-20 w-20 place-items-center text-center text-xs text-[var(--muted)]">
                  {game.victory ? 'The day holds' : game.endReason === 'seeds' ? 'Out of seeds' : 'Balance lost'}
                </div>
              )}
            </div>
            <div className="flex items-end gap-2">
              {upcoming.map((biome, index) => (
                <div key={`${biome}-${index}`} className="flex flex-col items-center gap-1 opacity-80">
                  <BiomeToken biome={biome} skin={skin} size={index === 0 ? 52 : 40} />
                  <span className="text-[10px] tracking-[0.14em] text-[var(--muted)] uppercase">{index === 0 ? 'Next' : ''}</span>
                </div>
              ))}
              {game.mode === 'infinite' && (
                <div
                  className="mb-4 flex flex-col items-center gap-1"
                  title="Each tile spends 1. Bounties return +4, score milestones return +6."
                  aria-label={`${game.seeds} seeds remaining`}
                >
                  <span
                    className={`relative flex h-12 min-w-12 flex-col items-center justify-center gap-0.5 rounded-2xl border px-1.5 text-[var(--ink)] ${delta?.seeds ? 'seed-gain' : 'border-[var(--line)]'}`}
                  >
                    <Sprout size={13} />
                    <span key={game.seeds} className="score-pop text-sm leading-none font-medium tabular-nums">
                      {game.seeds}
                    </span>
                    {delta && delta.seeds > 0 && (
                      <span
                        key={`s-${delta.id}`}
                        className="score-delta absolute -right-1 -top-2 text-[10px] font-medium text-[var(--good)]"
                        aria-hidden
                      >
                        +{delta.seeds}
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] tracking-[0.14em] text-[var(--muted)] uppercase">Seeds</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex w-full items-center justify-between gap-2 text-xs text-[var(--muted)]">
            <span>Best {best}</span>
            <span>
              {game.mode === 'daily' ? (ended ? 'Daily complete' : `${Math.max(0, DAILY_LENGTH - game.placedCount)} left`) : 'Zen'}
              <span className="ml-2 inline-flex items-center gap-1 sm:hidden">
                <Flame size={12} />
                {streak}
              </span>
            </span>
            <span className="flex items-center gap-2">
              {ended && (
                <button type="button" className="text-[var(--ink)]" onClick={onResults}>
                  Results
                </button>
              )}
              <button type="button" className="inline-flex items-center gap-1 text-[var(--ink)]" onClick={onReset}>
                <RotateCcw size={13} />
                {game.mode === 'daily' ? 'Replay' : 'New'}
              </button>
            </span>
          </div>
        </div>
      </footer>
      <p className="sr-only" aria-live="polite">
        {status} Score {game.score}
        {delta && delta.gained > 0 ? `, plus ${delta.gained}` : ''}
        {delta && delta.lost > 0 ? `, minus ${delta.lost}` : ''}. Harmony {harmony} percent.
        {game.mode === 'infinite' ? ` Seeds ${game.seeds}.` : ''}
        {game.goldenFlow ? ' Golden flow times two.' : game.goldenReady ? ' Flow ready.' : ''}
        Bounty {game.bounty.label}
        {delta && delta.harmony !== 0
          ? delta.harmony > 0
            ? `, plus ${delta.harmony}`
            : `, minus ${Math.abs(delta.harmony)}`
          : ''}
        .
      </p>
    </>
  )
}

function BiomeToken({ biome, skin, size }: { biome: Biome; skin: SkinName; size: number }) {
  const paint = biomePaint(skin, biome)
  const Icon = ICONS[biome]
  return (
    <span
      className="hex-clip grid place-items-center shadow-sm"
      style={{ width: size, height: size, background: `linear-gradient(180deg, ${paint.face[0]}, ${paint.face[1]})` }}
    >
      <Icon color={paint.ink} size={Math.round(size * 0.38)} strokeWidth={1.75} aria-hidden />
    </span>
  )
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      className="glass grid h-9 w-9 place-items-center rounded-full text-[var(--ink)] sm:h-10 sm:w-10"
      aria-label={label}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function ModeButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean
  label: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className="flex h-8 items-center gap-1 rounded-full px-3 text-xs"
      style={{ background: active ? 'var(--panel-solid)' : 'transparent', color: 'var(--ink)' }}
      onClick={onClick}
    >
      {children}
      {label}
    </button>
  )
}

function flowChrome(game: GameState): string {
  if (game.goldenFlow) return 'golden-flow'
  if (game.goldenReady) return 'golden-ready'
  return ''
}

function useScoreDelta(effects: PlacementEffects | null, pulse: number) {
  const [delta, setDelta] = useState<{ id: number; gained: number; lost: number; harmony: number; seeds: number } | null>(null)

  useEffect(() => {
    if (!effects?.valid) {
      if (!effects) setDelta(null)
      return
    }
    if (effects.gained === 0 && effects.lost === 0 && effects.harmonyDelta === 0 && effects.seedsGained === 0) {
      setDelta(null)
      return
    }
    const next = {
      id: pulse,
      gained: effects.gained,
      lost: effects.lost,
      harmony: effects.harmonyDelta,
      seeds: effects.seedsGained,
    }
    setDelta(next)
    const timer = window.setTimeout(() => {
      setDelta((current) => (current?.id === next.id ? null : current))
    }, 2400)
    return () => window.clearTimeout(timer)
  }, [effects, pulse])

  return delta
}

function harmonyColor(harmony: number): string {
  if (harmony > 60) return '#2f9a62'
  if (harmony > 30) return '#e0a045'
  return '#d45d4a'
}
