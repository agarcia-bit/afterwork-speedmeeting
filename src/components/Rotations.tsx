import { useState } from 'react'
import type { Participant } from '../types'
import type { SolveStats } from '../solver'
import { groupColor } from '../colors'
import TableCard from './TableCard'

interface Props {
  rotations: string[][][]
  people: Map<string, Participant>
  lockedCount: number
  stats: SolveStats | null
  warnings: string[]
  onLock: (count: number) => void
  onPrint: () => void
}

function pct(x: number) {
  return `${Math.round(x * 100)} %`
}

export default function Rotations({
  rotations,
  people,
  lockedCount,
  stats,
  warnings,
  onLock,
  onPrint,
}: Props) {
  const [focus, setFocus] = useState<string | null>(null)

  const focusPerson = focus ? (people.get(focus) ?? null) : null
  const trail = focusPerson
    ? rotations.map((rot) => {
        const t = rot.findIndex((table) => table.includes(focusPerson.id))
        return t === -1 ? null : t + 1
      })
    : []

  // Les groupes présents dans le tirage : la couleur remplace le nom sur les cartes.
  const legend = new Map<string, string>()
  for (const rot of rotations)
    for (const table of rot)
      for (const id of table) {
        const g = people.get(id)?.group.trim()
        if (g) legend.set(g, groupColor(g))
      }

  if (rotations.length === 0) {
    return (
      <section className="card">
        <div className="card-head">
          <h2 className="card-title">Plan des rotations</h2>
        </div>
        <p className="empty">
          Renseigne tes participants, choisis le nombre de places par table et de rotations,
          <br />
          puis lance la génération.
        </p>
      </section>
    )
  }

  return (
    <section className="card">
      <div className="card-head">
        <h2 className="card-title">Plan des rotations</h2>
        <button className="btn btn-ghost btn-sm" onClick={onPrint}>
          Imprimer
        </button>
      </div>

      {stats && (
        <div className="stats">
          <div
            className={`stat ${
              stats.groupConflicts === 0
                ? 'good'
                : stats.groupConflicts <= stats.minConflicts
                  ? 'warn'
                  : 'bad'
            }`}
          >
            <div className="stat-value">{stats.groupConflicts}</div>
            <div className="stat-label">
              Conflit{stats.groupConflicts > 1 ? 's' : ''} de groupe
              {stats.minConflicts > 0 && stats.groupConflicts <= stats.minConflicts
                ? ' · minimum inévitable'
                : ''}
            </div>
          </div>
          <div className={`stat ${stats.uniqueRatio > 0.95 ? 'good' : stats.uniqueRatio > 0.8 ? 'warn' : 'bad'}`}>
            <div className="stat-value">{pct(stats.uniqueRatio)}</div>
            <div className="stat-label">Rencontres inédites</div>
          </div>
          <div className="stat">
            <div className="stat-value">{stats.repeatEncounters}</div>
            <div className="stat-label">
              Doublons{stats.minRepeats > 0 ? ` · plancher ${stats.minRepeats}` : ''}
            </div>
          </div>
          <div className="stat">
            <div className="stat-value">{stats.uniquePairs}</div>
            <div className="stat-label">Paires réunies ({pct(stats.coverage)} du total)</div>
          </div>
        </div>
      )}

      {focusPerson && (
        <div className="focus-bar">
          <span className="dot" style={{ background: groupColor(focusPerson.group) }} />
          <b>{focusPerson.name}</b>
          <span className="focus-trail">
            {trail.map((t, i) => (
              <span key={i}>
                {i > 0 && <i>→</i>}
                {t === null ? '—' : `Table ${t}`}
              </span>
            ))}
          </span>
          <button className="btn btn-icon" onClick={() => setFocus(null)} aria-label="Ne plus suivre">
            ×
          </button>
        </div>
      )}

      {stats && (
        <div className={`verdict ${stats.optimal ? 'ok' : ''}`}>
          {stats.optimal ? (
            <>
              <b>Optimum atteint.</b> Aucun autre tirage ne fera mieux avec ces réglages —
              regénérer ne changera rien.
            </>
          ) : (
            <>
              <b>Meilleur tirage trouvé en 2 s.</b> Regénérer repart de celui-ci et ne peut que
              l'améliorer, jamais le dégrader.
            </>
          )}
        </div>
      )}

      {warnings.map((w, i) => (
        <div className={`banner ${w.startsWith('!') ? 'bad' : 'warn'}`} key={i}>
          {w.replace(/^!/, '')}
        </div>
      ))}

      {legend.size > 0 && (
        <div className="legend plan-legend">
          {[...legend].map(([g, color]) => (
            <span className="chip" key={g}>
              <span className="dot" style={{ background: color }} />
              {g}
            </span>
          ))}
        </div>
      )}

      {!focusPerson && (
        <p className="plan-hint">
          Clique sur un nom pour suivre son parcours d'une rotation à l'autre.
        </p>
      )}

      {rotations.map((rot, r) => {
        const locked = r < lockedCount
        return (
          <div className="rotation" key={r}>
            <div className="rotation-head">
              <h3 className="rotation-name">Rotation {r + 1}</h3>
              {locked && <span className="badge locked">verrouillée</span>}
              <span className="spacer" />
              {locked ? (
                <button className="btn btn-ghost btn-sm" onClick={() => onLock(r)}>
                  Déverrouiller
                </button>
              ) : (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => onLock(r + 1)}
                  title="Fige cette rotation et les précédentes lors des prochaines générations"
                >
                  Verrouiller jusqu'ici
                </button>
              )}
            </div>
            <div className="tables">
              {rot.map((ids, t) => (
                <TableCard
                  key={t}
                  index={t}
                  ids={ids}
                  people={people}
                  focusId={focus}
                  onFocus={(id) => setFocus((cur) => (cur === id ? null : id))}
                />
              ))}
            </div>
          </div>
        )
      })}
    </section>
  )
}
