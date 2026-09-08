import type { Participant } from '../types'
import { groupColor } from '../colors'

interface Props {
  index: number
  ids: string[]
  people: Map<string, Participant>
  /** Le nom du groupe est masqué en mode écran : seule la pastille reste lisible de loin. */
  showGroup?: boolean
}

/** Identifiants en conflit : au moins deux personnes du même groupe à cette table. */
export function conflictingIds(ids: string[], people: Map<string, Participant>): Set<string> {
  const byGroup = new Map<string, string[]>()
  for (const id of ids) {
    const g = people.get(id)?.group.trim()
    if (!g) continue
    byGroup.set(g, [...(byGroup.get(g) ?? []), id])
  }
  const out = new Set<string>()
  for (const members of byGroup.values()) {
    if (members.length > 1) members.forEach((id) => out.add(id))
  }
  return out
}

export default function TableCard({ index, ids, people, showGroup = true }: Props) {
  const conflicts = conflictingIds(ids, people)
  const seats = ids
    .map((id) => people.get(id))
    .filter((p): p is Participant => p !== undefined)
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'))

  return (
    <div className={`table-card${conflicts.size > 0 ? ' conflict' : ''}`}>
      <div className="table-head">
        <span>Table {index + 1}</span>
        <span>{seats.length}</span>
      </div>
      {seats.map((p) => (
        <div className={`seat${conflicts.has(p.id) ? ' conflict' : ''}`} key={p.id}>
          <span className="dot" style={{ background: groupColor(p.group) }} />
          <span>{p.name}</span>
          {showGroup && p.group.trim() && <span className="seat-group">{p.group.trim()}</span>}
        </div>
      ))}
    </div>
  )
}
