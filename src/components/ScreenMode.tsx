import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Participant } from '../types'

interface Props {
  rotations: string[][][]
  people: Map<string, Participant>
  minutes: number
  index: number
  onIndex: (i: number) => void
  onClose: () => void
}

/** Au-delà, les noms ne tiennent plus en grand : on pagine. */
const MAX_TABLES_PER_PAGE = 6
const PAGE_SECONDS = 12

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

/** Découpe les tables en pages de taille équilibrée. */
function paginate<T>(items: T[]): T[][] {
  if (items.length <= MAX_TABLES_PER_PAGE) return [items]
  const pages = Math.ceil(items.length / MAX_TABLES_PER_PAGE)
  const size = Math.ceil(items.length / pages)
  return Array.from({ length: pages }, (_, i) => items.slice(i * size, (i + 1) * size))
}

export default function ScreenMode({ rotations, people, minutes, index, onIndex, onClose }: Props) {
  const total = minutes * 60
  const [remaining, setRemaining] = useState(total)
  const [running, setRunning] = useState(false)
  const [page, setPage] = useState(0)
  const rang = useRef(false)
  const grid = useRef<HTMLDivElement>(null)

  const tables = rotations[index] ?? []
  const pages = useMemo(
    () => paginate(tables.map((ids, t) => ({ number: t + 1, ids }))),
    [tables],
  )
  const current = pages[Math.min(page, pages.length - 1)] ?? []

  useEffect(() => {
    setRemaining(total)
    setRunning(false)
    setPage(0)
    rang.current = false
  }, [total, index])

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

  // Défilement des pages : chacun doit voir sa table sans qu'on touche à rien.
  useEffect(() => {
    if (pages.length < 2) return
    const id = setInterval(
      () => setPage((p) => (p + 1) % pages.length),
      PAGE_SECONDS * 1000,
    )
    return () => clearInterval(id)
  }, [pages.length, index])

  // La taille des noms dépend du nombre de tables affichées et de convives par
  // table : plutôt que de l'estimer, on l'ajuste sur le rendu réel jusqu'à ce
  // que chaque liste tienne entièrement dans sa carte.
  useLayoutEffect(() => {
    const el = grid.current
    if (!el) return
    const fit = () => {
      const lists = Array.from(el.querySelectorAll('ul'))
      const overflows = () => lists.some((u) => u.scrollHeight > u.clientHeight + 1)
      let size = 40
      el.style.setProperty('--name-size', `${size}px`)
      while (size > 12 && overflows()) {
        size -= 1
        el.style.setProperty('--name-size', `${size}px`)
      }
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [page, index, pages])

  const go = useCallback(
    (delta: number) => onIndex(Math.min(rotations.length - 1, Math.max(0, index + delta))),
    [index, onIndex, rotations.length],
  )

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        setPage((p) => (p + (e.key === 'ArrowDown' ? 1 : pages.length - 1)) % pages.length)
      } else if (e.key === ' ') {
        e.preventDefault()
        setRunning((r) => !r)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, onClose, pages.length])

  const over = remaining < 0
  const abs = Math.abs(remaining)
  const clock = `${over ? '+' : ''}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, '0')}`

  return (
    <div className="screen" style={{ ['--cols' as string]: Math.min(3, current.length) }}>
      <header className="screen-head">
        <div className="screen-title">
          <span className="screen-kicker">Afterwork Interasso</span>
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

      <div className="screen-grid" ref={grid}>
        {current.map(({ number, ids }) => {
          const seats = ids
            .map((id) => people.get(id))
            .filter((p): p is Participant => p !== undefined)
            .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
          return (
            <section className="screen-table" key={number}>
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
          )
        })}
      </div>

      {pages.length > 1 && (
        <footer className="screen-foot">
          <span>
            Tables {current[0]?.number} à {current[current.length - 1]?.number} sur {tables.length}
          </span>
          <div className="screen-dots">
            {pages.map((_, i) => (
              <button
                key={i}
                className={`screen-dot${i === page % pages.length ? ' on' : ''}`}
                onClick={() => setPage(i)}
                aria-label={`Page ${i + 1}`}
              />
            ))}
          </div>
        </footer>
      )}
    </div>
  )
}
