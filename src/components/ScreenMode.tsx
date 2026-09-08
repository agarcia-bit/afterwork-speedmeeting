import { useCallback, useEffect, useRef, useState } from 'react'
import type { Participant } from '../types'
import TableCard from './TableCard'

interface Props {
  rotations: string[][][]
  people: Map<string, Participant>
  minutes: number
  index: number
  onIndex: (i: number) => void
  onClose: () => void
}

function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
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

export default function ScreenMode({ rotations, people, minutes, index, onIndex, onClose }: Props) {
  const total = minutes * 60
  const [remaining, setRemaining] = useState(total)
  const [running, setRunning] = useState(false)
  const rang = useRef(false)

  useEffect(() => {
    setRemaining(total)
    setRunning(false)
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
  const tables = rotations[index] ?? []

  return (
    <div className="screen">
      <div className="screen-head">
        <h2 className="screen-title">
          Rotation {index + 1}
          <span style={{ color: 'var(--muted)' }}> / {rotations.length}</span>
        </h2>
        <span className="spacer" />
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
            Rotation suivante →
          </button>
          <button className="btn btn-ghost" onClick={onClose}>
            Quitter
          </button>
        </div>
      </div>

      <div className="screen-tables">
        {tables.map((ids, t) => (
          <TableCard key={t} index={t} ids={ids} people={people} showGroup={false} />
        ))}
      </div>
    </div>
  )
}
