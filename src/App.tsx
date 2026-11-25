import { useEffect, useRef, useState } from 'react'
import { GameCanvas } from './components/GameCanvas'
import { ConfirmDialog, RulesDialog, SummaryDialog } from './components/Dialogs'
import { HUD, type ToastItem } from './components/HUD'
import { audio } from './game/audio'
import { applyWildcard, createGame, currentBiome, findTile, placeTile, type PlacementEffects } from './game/engine'
import { hexKey, parseHexKey } from './game/hexMath'
import { todayString } from './game/seededRandom'
import {
  applyStats,
  loadSave,
  loadSettings,
  loadStats,
  writeSave,
  writeSettings,
  writeStats,
  type SaveFile,
} from './game/storage'
import type { Biome, GameMode, GameState, Settings, Stats } from './game/types'

function boot(): { save: SaveFile; game: GameState } {
  const save = loadSave()
  const game = save.infinite ?? createGame('infinite')
  return { save: { ...save, infinite: game }, game }
}

export default function App() {
  const [session] = useState(boot)
  const saveRef = useRef<SaveFile>(session.save)
  const [game, setGame] = useState<GameState>(session.game)
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const [stats, setStats] = useState<Stats>(() => {
    const loaded = loadStats()
    const next = applyStats(loaded, session.game)
    if (next !== loaded) writeStats(next)
    return next
  })
  const [status, setStatus] = useState(session.game.log)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [wildcardOn, setWildcardOn] = useState(false)
  const [target, setTarget] = useState<string | null>(null)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [pulse, setPulse] = useState(0)
  const [effects, setEffects] = useState<PlacementEffects | null>(null)
  const toastId = useRef(1)
  const wasOver = useRef(session.game.gameOver || session.game.victory)

  function commitGame(next: GameState, quiet = false) {
    if (next.mode === 'infinite') saveRef.current.infinite = next
    else saveRef.current.daily = next
    writeSave(saveRef.current)
    setStats((current) => {
      const updated = applyStats(current, next)
      if (updated !== current) writeStats(updated)
      return updated
    })
    if (!quiet) {
      const over = next.gameOver || next.victory
      if (over && !wasOver.current) setSummaryOpen(true)
      wasOver.current = over
    }
    setGame(next)
  }

  useEffect(() => {
    writeSave(saveRef.current)
  }, [])

  useEffect(() => {
    const unlock = () => audio.unlock()
    window.addEventListener('pointerdown', unlock)
    return () => window.removeEventListener('pointerdown', unlock)
  }, [])

  useEffect(() => {
    writeSettings(settings)
    audio.setMuted(settings.muted)
    document.documentElement.dataset.theme = settings.theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', settings.theme === 'night' ? '#121816' : '#f4efe4')
  }, [settings])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === '?' || (event.shiftKey && event.key === '/')) setRulesOpen(true)
      if (event.key === 'Escape') {
        setRulesOpen(false)
        setSummaryOpen(false)
        setConfirmOpen(false)
        setWildcardOn(false)
        setTarget(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function pushToast(text: string, tone: ToastItem['tone']) {
    const id = toastId.current++
    setToasts((list) => [...list.slice(-2), { id, text, tone }])
    window.setTimeout(() => setToasts((list) => list.filter((item) => item.id !== id)), 3400)
  }

  function note(next: PlacementEffects) {
    setEffects(next)
    setPulse((value) => value + 1)
    setStatus(next.status)
    for (const toast of next.toasts) pushToast(toast.text, toast.tone)
  }

  function handlePlace(q: number, r: number) {
    if (wildcardOn) {
      if (findTile(game, q, r)) setTarget(hexKey(q, r))
      return
    }
    const biome = currentBiome(game)
    const result = placeTile(game, q, r)
    if (!result.effects.valid) {
      audio.playDeny()
      return
    }
    if (biome) audio.playFor(biome, result.effects)
    commitGame(result.state)
    if (!settings.hintSeen) setSettings((current) => ({ ...current, hintSeen: true }))
    note(result.effects)
  }

  function handleWildcard(
    action: { type: 'clear'; q: number; r: number } | { type: 'transform'; q: number; r: number; biome: Biome },
  ) {
    const result = applyWildcard(game, action)
    if (!result.effects.valid) {
      audio.playDeny()
      return
    }
    audio.playRestore()
    commitGame(result.state)
    setTarget(null)
    setWildcardOn(false)
    note(result.effects)
  }

  function adopt(next: GameState) {
    wasOver.current = next.gameOver || next.victory
    commitGame(next, true)
    setStatus(next.log)
    setWildcardOn(false)
    setTarget(null)
  }

  function switchMode(mode: GameMode) {
    if (mode === game.mode) return
    const today = todayString()
    if (mode === 'daily') {
      const saved = saveRef.current.daily
      adopt(saved && saved.date === today ? saved : createGame('daily', { date: today }))
    } else {
      adopt(saveRef.current.infinite ?? createGame('infinite'))
    }
    setSummaryOpen(false)
  }

  function reset() {
    const today = todayString()
    const next = game.mode === 'daily' ? createGame('daily', { date: today }) : createGame('infinite')
    adopt(next)
    setConfirmOpen(false)
    setSummaryOpen(false)
  }

  function requestReset() {
    if (game.score > 0 && !game.gameOver && !game.victory) setConfirmOpen(true)
    else reset()
  }

  const targetTile = target ? findTile(game, parseHexKey(target).q, parseHexKey(target).r) ?? null : null
  const locked = rulesOpen || summaryOpen || confirmOpen

  return (
    <main className="relative h-dvh w-full overflow-hidden text-[var(--ink)]">
      <GameCanvas
        game={game}
        theme={settings.theme}
        season={game.season}
        wildcard={wildcardOn}
        selectedKey={target}
        pulse={pulse}
        effects={effects}
        inputLocked={locked}
        onPlace={handlePlace}
        onSelect={(q, r) => {
          if (findTile(game, q, r)) setTarget(hexKey(q, r))
        }}
      />
      <HUD
        game={game}
        stats={stats}
        settings={settings}
        status={status}
        wildcardOn={wildcardOn}
        target={targetTile}
        toasts={toasts}
        onToggleMute={() => setSettings((current) => ({ ...current, muted: !current.muted }))}
        onToggleTheme={() => setSettings((current) => ({ ...current, theme: current.theme === 'day' ? 'night' : 'day' }))}
        onMode={switchMode}
        onRules={() => setRulesOpen(true)}
        onReset={requestReset}
        onResults={() => setSummaryOpen(true)}
        onToggleWildcard={() => {
          setWildcardOn((armed) => !armed)
          setTarget(null)
        }}
        onWildcard={handleWildcard}
        onCancelTarget={() => setTarget(null)}
        onDismissHint={() => setSettings((current) => ({ ...current, hintSeen: true }))}
      />
      <RulesDialog open={rulesOpen} onClose={() => setRulesOpen(false)} />
      <SummaryDialog open={summaryOpen} game={game} onClose={() => setSummaryOpen(false)} onReplay={reset} />
      <ConfirmDialog open={confirmOpen} mode={game.mode} onClose={() => setConfirmOpen(false)} onConfirm={reset} />
    </main>
  )
}
