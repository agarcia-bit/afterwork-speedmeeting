import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Participant } from '../types'

interface Props {
  title: string
  rotations: string[][][]
  people: Map<string, Participant>
  minutes: number
  index: number
  onIndex: (i: number) => void
  onClose: () => void
}

/** Bornes de la taille des noms, en pixels. */
const MIN_NAME = 9
const MAX_NAME = 56

function beep() {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const now = ctx.currentTime
    // Trois brèves impulsions, assez présentes pour couvrir un brouhaha de bar.
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.0001, now + i * 0.35)
      gain.gain.exponentialRampToValueAtTime(0.4, now + i * 0.35 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.35 + 0.28)
      osc.connect(gain).connect(ctx.destination)
      osc.start(now + i * 0.35)
      osc.stop(now + i * 0.35 + 0.3)
    }
    setTimeout(() => ctx.close(), 1500)
  } catch {
    // Pas de son disponible : le minuteur reste visuel.
  }
}

export default function ScreenMode({
  title,
  rotations,
  people,
  minutes,
  index,
  onIndex,
  onClose,
}: Props) {
  const total = minutes * 60
  const [remaining, setRemaining] = useState(total)
  const [running, setRunning] = useState(false)
  const rang = useRef(false)
  const grid = useRef<HTMLDivElement>(null)

  const tables = useMemo(
    () =>
      (rotations[index] ?? []).map((ids, t) => ({
        number: t + 1,
        seats: ids
          .map((id) => people.get(id))
          .filter((p): p is Participant => p !== undefined)
          .sort((a, b) => a.name.localeCompare(b.name, 'fr')),
      })),
    [rotations, index, people],
  )

  useEffect(() => {
    setRemaining(total)
    setRunning(false)
    rang.current = false
  }, [total, index])

  // Rien ne doit bouger sous l'écran projeté, molette comprise.
  useEffect(() => {
    const root = document.documentElement
    const previous = { body: document.body.style.overflow, root: root.style.overflow }
    document.body.style.overflow = 'hidden'
    root.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous.body
      root.style.overflow = previous.root
    }
  }, [])

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setRemaining((r) => r - 1), 1000)
    return () => clearInterval(id)
  }, [running])

  useEffect(() => {
    if (remaining <= 0 && !rang.current) {
      rang.current = true
      beep()
    }
  }, [remaining])

  // Toutes les tables doivent tenir sur un seul écran, sans défilement ni
  // changement de page : chacun doit pouvoir y lire la sienne. On essaie
  // chaque découpage en colonnes et on garde celui qui permet les plus grands
  // noms, mesuré sur le rendu réel plutôt qu'estimé.
  useLayoutEffect(() => {
    const el = grid.current
    if (!el || tables.length === 0) return

    const fit = () => {
      // On ne mesure que les listes : la grille partage déjà sa hauteur entre
      // les rangées, et l'animation d'entrée décale les cartes, ce qui gonfle
      // artificiellement la zone de défilement de la grille.
      const clipped = () =>
        Array.from(el.querySelectorAll('ul')).some((u) => u.scrollHeight > u.clientHeight + 1)

      const tryColumns = (columns: number) => {
        el.style.setProperty('--cols', String(columns))
        let low = MIN_NAME
        let high = MAX_NAME
        let best = 0
        while (low <= high) {
          const mid = Math.floor((low + high) / 2)
          el.style.setProperty('--name-size', `${mid}px`)
          if (clipped()) high = mid - 1
          else {
            best = mid
            low = mid + 1
          }
        }
        return best
      }

      let bestColumns = 1
      let bestSize = 0
      for (let columns = 1; columns <= Math.min(tables.length, 8); columns++) {
        const size = tryColumns(columns)
        if (size > bestSize) {
          bestSize = size
          bestColumns = columns
        }
      }
      el.style.setProperty('--cols', String(bestColumns))
      el.style.setProperty('--name-size', `${Math.max(bestSize, MIN_NAME)}px`)
    }

    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [tables])

  const go = useCallback(
    (delta: number) => onIndex(Math.min(rotations.length - 1, Math.max(0, index + delta))),
    [index, onIndex, rotations.length],
  )

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === ' ') {
        e.preventDefault()
        setRunning((r) => !r)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, onClose])

  const over = remaining < 0
  const abs = Math.abs(remaining)
  const clock = `${over ? '+' : ''}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, '0')}`

  // Jauge de temps restant : lisible du fond de la salle, sans lire l'heure.
  const elapsed = total > 0 ? Math.min(1, Math.max(0, 1 - remaining / total)) : 1

  return (
    <div className="screen">
      <div
        className={`screen-progress${over ? ' over' : ''}`}
        style={{ transform: `scaleX(${elapsed})` }}
      />

      <header className="screen-head">
        <div className="screen-title">
          <span className="screen-kicker">{title}</span>
          <h2>
            Rotation <b>{index + 1}</b>
            <span className="screen-of">sur {rotations.length}</span>
          </h2>
        </div>

        <div className={`timer${over ? ' over' : remaining <= 60 ? ' low' : ''}`}>{clock}</div>

        <div className="screen-controls">
          <button className="btn btn-primary" onClick={() => setRunning((r) => !r)}>
            {running ? 'Pause' : remaining === total ? 'Démarrer' : 'Reprendre'}
          </button>
          <button
            className="btn"
            onClick={() => {
              setRemaining(total)
              setRunning(false)
              rang.current = false
            }}
          >
            Reset
          </button>
          <button className="btn" onClick={() => go(-1)} disabled={index === 0}>
            ←
          </button>
          <button className="btn" onClick={() => go(1)} disabled={index >= rotations.length - 1}>
            Suivante →
          </button>
          <button className="btn btn-ghost" onClick={onClose}>
            Quitter
          </button>
        </div>
      </header>

      <div className="screen-grid" ref={grid} key={index}>
        {tables.map(({ number, seats }, i) => (
          <section
            className="screen-table"
            key={number}
            style={{ ['--i' as string]: i }}
          >
            <h3>
              <span className="screen-table-num">{number}</span>
              Table
            </h3>
            <ul>
              {seats.map((p) => (
                <li key={p.id}>{p.name}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <footer className="screen-sign">
        <span>{title}</span>
        <span className="screen-sign-dot" />
        <span>
          {tables.length} table{tables.length > 1 ? 's' : ''} · {minutes} min par rotation
        </span>
      </footer>
    </div>
  )
}
