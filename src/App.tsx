import { useEffect, useMemo, useState } from 'react'
import Participants from './components/Participants'
import Settings from './components/Settings'
import RotationsView from './components/Rotations'
import ScreenMode from './components/ScreenMode'
import DataModal from './components/DataModal'
import { solve, statsFor, tableSizes } from './solver'
import { load, normalize, save } from './storage'
import type { EventState, Participant } from './types'

let seq = 0
const newId = () => `p${Date.now().toString(36)}-${(seq++).toString(36)}`

export default function App() {
  const [state, setState] = useState<EventState>(() => load())
  const [busy, setBusy] = useState(false)
  const [screen, setScreen] = useState(false)
  const [screenIndex, setScreenIndex] = useState(0)
  const [modal, setModal] = useState(false)

  useEffect(() => save(state), [state])

  const present = useMemo(() => state.participants.filter((p) => p.present), [state.participants])
  const people = useMemo(
    () => new Map<string, Participant>(state.participants.map((p) => [p.id, p])),
    [state.participants],
  )

  const stats = useMemo(
    () =>
      state.rotations.length > 0
        ? statsFor(
            present.map((p) => ({ id: p.id, group: p.group })),
            state.rotations,
            state.perTable,
          )
        : null,
    [present, state.rotations, state.perTable],
  )

  const warnings = useMemo(() => {
    const out: string[] = []
    if (present.length === 0) return out

    const sizes = tableSizes(present.length, state.perTable)
    const tableCount = sizes.length
    const biggest = Math.max(...sizes)

    const counts = new Map<string, number>()
    for (const p of present) {
      const g = p.group.trim()
      if (g) counts.set(g, (counts.get(g) ?? 0) + 1)
    }
    for (const [g, n] of counts) {
      if (n > tableCount) {
        out.push(
          `!Le groupe « ${g} » compte ${n} personnes pour seulement ${tableCount} tables : au moins ${n - tableCount} de ses membres se retrouvent ensemble à chaque rotation. Réduis le nombre de places par table pour créer plus de tables.`,
        )
      }
    }

    const maxClean = biggest > 1 ? Math.floor((present.length - 1) / (biggest - 1)) : 0
    if (state.rotationCount > maxClean) {
      out.push(
        `Avec ${present.length} présents et des tables de ${biggest}, ${maxClean} rotation${maxClean > 1 ? 's' : ''} suffisent à faire le tour : au-delà, des re-rencontres sont mathématiquement inévitables et l'outil les répartit au mieux.`,
      )
    }

    if (stats && stats.groupConflicts > 0 && counts.size > 0) {
      out.push(
        `!${stats.groupConflicts} rencontre${stats.groupConflicts > 1 ? 's' : ''} entre membres d'un même groupe n'${stats.groupConflicts > 1 ? 'ont' : 'a'} pas pu être évitée${stats.groupConflicts > 1 ? 's' : ''} (signalée${stats.groupConflicts > 1 ? 's' : ''} en rouge dans les tables).`,
      )
    }
    return out
  }, [present, state.perTable, state.rotationCount, stats])

  // --- Participants ---

  const addParticipant = (name: string, group: string) =>
    setState((s) => ({
      ...s,
      participants: [...s.participants, { id: newId(), name, group, present: true }],
    }))

  const addMany = (rows: { name: string; group: string }[]) =>
    setState((s) => ({
      ...s,
      participants: [
        ...s.participants,
        ...rows.map((r) => ({ id: newId(), name: r.name, group: r.group, present: true })),
      ],
    }))

  const updateParticipant = (id: string, patch: Partial<Participant>) =>
    setState((s) => ({
      ...s,
      participants: s.participants.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }))

  const removeParticipant = (id: string) =>
    setState((s) => ({
      ...s,
      participants: s.participants.filter((p) => p.id !== id),
      rotations: s.rotations.map((rot) => rot.map((t) => t.filter((x) => x !== id))),
    }))

  // --- Tirage ---

  function generate() {
    if (present.length < 2) return
    setBusy(true)
    // Laisse le navigateur peindre l'état « Calcul… » avant de bloquer le fil.
    setTimeout(() => {
      const result = solve({
        participants: present.map((p) => ({ id: p.id, group: p.group })),
        perTable: state.perTable,
        rotationCount: state.rotationCount,
        locked: state.rotations.slice(0, state.lockedCount),
        seed: Date.now() & 0x7fffffff,
      })
      setState((s) => ({
        ...s,
        rotations: result.rotations,
        lockedCount: Math.min(s.lockedCount, result.rotations.length),
      }))
      setScreenIndex((i) => Math.min(i, Math.max(0, result.rotations.length - 1)))
      setBusy(false)
    }, 20)
  }

  const resetRotations = () => setState((s) => ({ ...s, rotations: [], lockedCount: 0 }))

  function importJson(text: string): string | null {
    try {
      const parsed = normalize(JSON.parse(text))
      setState(parsed)
      return null
    } catch {
      return "Ce texte n'est pas une sauvegarde valide."
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">Le 14 Avenue</span>
          <div>
            <h1 className="brand-title">
              Afterwork <em>Interasso</em>
            </h1>
            <p className="brand-sub">Speed meeting — plan de tables</p>
          </div>
        </div>
        <div className="topbar-actions">
          <button className="btn" onClick={() => setModal(true)}>
            Sauvegarde &amp; export
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setScreen(true)}
            disabled={state.rotations.length === 0}
          >
            Mode écran
          </button>
        </div>
      </header>

      <div className="layout">
        <div className="col">
          <Settings
            perTable={state.perTable}
            rotationCount={state.rotationCount}
            rotationMinutes={state.rotationMinutes}
            presentCount={present.length}
            lockedCount={state.lockedCount}
            onChange={(patch) => setState((s) => ({ ...s, ...patch }))}
            onGenerate={generate}
            onReset={resetRotations}
            busy={busy}
          />
          <Participants
            participants={state.participants}
            onAdd={addParticipant}
            onAddMany={addMany}
            onUpdate={updateParticipant}
            onRemove={removeParticipant}
          />
        </div>
        <div className="col">
          <RotationsView
            rotations={state.rotations}
            people={people}
            lockedCount={state.lockedCount}
            stats={stats}
            warnings={warnings}
            onLock={(count) => setState((s) => ({ ...s, lockedCount: count }))}
            onPrint={() => window.print()}
          />
        </div>
      </div>

      {screen && (
        <ScreenMode
          rotations={state.rotations}
          people={people}
          minutes={state.rotationMinutes}
          index={screenIndex}
          onIndex={setScreenIndex}
          onClose={() => setScreen(false)}
        />
      )}

      {modal && <DataModal state={state} onImport={importJson} onClose={() => setModal(false)} />}
    </div>
  )
}
