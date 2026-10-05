import { useMemo } from 'react'
import type { Participant } from '../types'
import { groupColor } from '../colors'
import { buildXlsx } from '../xlsx'
import { saveFile } from '../download'
import { journeysByGroup, NO_GROUP } from '../journeys'

interface Props {
  rotations: string[][][]
  people: Map<string, Participant>
}

/** Parcours de chacun : sa table à chaque rotation, regroupé par association. */
export default function PersonList({ rotations, people }: Props) {
  const groups = useMemo(() => journeysByGroup(rotations, people), [rotations, people])

  async function exportXlsx() {
    const header = ['Association', 'Nom', ...rotations.map((_, r) => `Rotation ${r + 1}`)]
    const rows = groups.flatMap(({ name, members }) =>
      members.map(({ person, tables }) => [
        name,
        person.name,
        ...tables.map((t) => (t === null ? '' : `Table ${t}`)),
      ]),
    )
    await saveFile('parcours-par-personne.xlsx', buildXlsx([header, ...rows]))
  }

  return (
    <div className="person-list">
      <div className="person-list-actions">
        <span className="card-hint">
          Table de chaque personne, rotation par rotation — classé par association.
        </span>
        <button className="btn btn-sm" onClick={exportXlsx}>
          Exporter en Excel
        </button>
      </div>

      {groups.map(({ name, members }) => (
        <section className="asso-block" key={name}>
          <h3 className="asso-head">
            <span className="dot" style={{ background: groupColor(name === NO_GROUP ? '' : name) }} />
            {name}
            <span className="asso-count">
              {members.length} personne{members.length > 1 ? 's' : ''}
            </span>
          </h3>
          <div className="person-table-wrap">
            <table className="person-table">
              <thead>
                <tr>
                  <th>Nom</th>
                  {rotations.map((_, r) => (
                    <th key={r}>R{r + 1}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members.map(({ person, tables }) => (
                  <tr key={person.id}>
                    <td>{person.name}</td>
                    {tables.map((t, r) => (
                      <td key={r}>
                        {t === null ? (
                          <span className="table-pill empty">—</span>
                        ) : (
                          <span className="table-pill">{t}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  )
}
