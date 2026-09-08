import type { Participant } from '../types'
import { groupColor } from '../colors'

interface Props {
  index: number
  ids: string[]
  people: Map<string, Participant>
  /** Le nom du groupe n'est utile qu'à l'impression : à l'écran, la couleur suffit. */
  showGroup?: boolean
  /** Participant suivi à travers les rotations. */
  focusId?: string | null
  onFocus?: (id: string) => void
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

export default function TableCard({
  index,
  ids,
  people,
  showGroup = true,
  focusId = null,
  onFocus,
}: Props) {
  const conflicts = conflictingIds(ids, people)
  const seats = ids
    .map((id) => people.get(id))
    .filter((p): p is Participant => p !== undefined)
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'))

  // Bandeau de composition : un segment par personne, regroupés par association.
  // Deux segments identiques côte à côte = deux membres du même groupe à table.
  const mix = [...seats].sort((a, b) =>
    (a.group.trim() || '￿').localeCompare(b.group.trim() || '￿', 'fr'),
  )
  const focused = focusId !== null && ids.includes(focusId)

  return (
    <div
      className={`table-card${conflicts.size > 0 ? ' conflict' : ''}${focused ? ' focused' : ''}`}
    >
      <div className="table-head">
        <span className="table-num">{index + 1}</span>
        <span className="table-label">Table</span>
        <span className="table-count">{seats.length}</span>
      </div>

      <div className="table-mix" aria-hidden="true">
        {mix.map((p) => (
          <span key={p.id} style={{ background: groupColor(p.group) }} />
        ))}
      </div>

      <div className="seats">
        {seats.map((p) => {
          const className = `seat${conflicts.has(p.id) ? ' conflict' : ''}${
            focusId === p.id ? ' is-focus' : ''
          }`
          const body = (
            <>
              <span className="dot" style={{ background: groupColor(p.group) }} />
              <span className="seat-name">{p.name}</span>
              {showGroup && p.group.trim() && <span className="seat-group">{p.group.trim()}</span>}
            </>
          )
          return onFocus ? (
            <button
              className={className}
              key={p.id}
              onClick={() => onFocus(p.id)}
              title={`${p.name}${p.group.trim() ? ` · ${p.group.trim()}` : ''} — suivre son parcours`}
            >
              {body}
            </button>
          ) : (
            <div className={className} key={p.id} title={p.group.trim() || undefined}>
              {body}
            </div>
          )
        })}
      </div>
    </div>
  )
}
