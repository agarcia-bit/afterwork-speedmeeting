import type { Participant } from '../types'
import type { SolveStats } from '../solver'
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
          <div className={`stat ${stats.groupConflicts === 0 ? 'good' : 'bad'}`}>
            <div className="stat-value">{stats.groupConflicts}</div>
            <div className="stat-label">Conflit{stats.groupConflicts > 1 ? 's' : ''} de groupe</div>
          </div>
          <div className={`stat ${stats.uniqueRatio > 0.95 ? 'good' : stats.uniqueRatio > 0.8 ? 'warn' : 'bad'}`}>
            <div className="stat-value">{pct(stats.uniqueRatio)}</div>
            <div className="stat-label">Rencontres inédites</div>
          </div>
          <div className="stat">
            <div className="stat-value">{stats.repeatEncounters}</div>
            <div className="stat-label">Doublons</div>
          </div>
          <div className="stat">
            <div className="stat-value">{stats.uniquePairs}</div>
            <div className="stat-label">Paires réunies ({pct(stats.coverage)} du total)</div>
          </div>
        </div>
      )}

      {warnings.map((w, i) => (
        <div className={`banner ${w.startsWith('!') ? 'bad' : 'warn'}`} key={i}>
          {w.replace(/^!/, '')}
        </div>
      ))}

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
                <TableCard key={t} index={t} ids={ids} people={people} />
              ))}
            </div>
          </div>
        )
      })}
    </section>
  )
}
