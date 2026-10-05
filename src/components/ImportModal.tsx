import { useMemo, useState } from 'react'
import type { Participant } from '../types'
import { parseList, type Layout, type Separator } from '../import'
import { groupColor } from '../colors'

interface Props {
  participants: Participant[]
  onImport: (rows: { name: string; group: string }[]) => void
  onClose: () => void
}

type SepChoice = 'auto' | Separator | 'none'
type LayoutChoice = 'auto' | Layout
type HeaderChoice = 'auto' | 'yes' | 'no'

const SEP_LABELS: { value: SepChoice; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: '\t', label: 'Tabulation' },
  { value: ';', label: 'Point-virgule' },
  { value: ',', label: 'Virgule' },
  { value: 'none', label: 'Aucun' },
]

const LAYOUT_LABELS: { value: LayoutChoice; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'name', label: 'Nom seul' },
  { value: 'name-group', label: 'Nom + groupe' },
  { value: 'group-name', label: 'Groupe + nom' },
]

const PREVIEW_ROWS = 8

function Choice<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div className="choice">
      <span className="choice-label">{label}</span>
      <div className="choice-options">
        {options.map((o) => (
          <button
            key={o.value}
            className={`btn btn-sm${o.value === value ? ' btn-primary' : ' btn-ghost'}`}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function ImportModal({ participants, onImport, onClose }: Props) {
  const [text, setText] = useState('')
  const [sep, setSep] = useState<SepChoice>('auto')
  const [layout, setLayout] = useState<LayoutChoice>('auto')
  const [header, setHeader] = useState<HeaderChoice>('auto')
  const [withDuplicates, setWithDuplicates] = useState(false)

  const result = useMemo(
    () =>
      parseList(
        text,
        participants.map((p) => p.name),
        {
          separator: sep === 'auto' ? undefined : sep === 'none' ? null : sep,
          layout: layout === 'auto' ? undefined : layout,
          header: header === 'auto' ? undefined : header === 'yes',
        },
      ),
    [text, participants, sep, layout, header],
  )

  const kept = withDuplicates ? result.rows : result.rows.filter((r) => !r.duplicate)

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="card-head">
          <h2 className="card-title">Importer une liste</h2>
          <button className="btn btn-icon" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </div>

        <p className="card-hint">
          Colle ta liste depuis un tableur, un mail ou un document — une personne par ligne.
          Vérifie l'aperçu avant d'importer : rien n'est ajouté tant que tu ne valides pas.
        </p>

        <textarea
          className="modal-text import-text"
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'Marie Delcourt ; PAF\nPaul Vasseur ; ARCOPRO\nSophie Leroy'}
        />

        {text.trim() !== '' && (
          <>
            <div className="choices">
              <Choice label="Séparateur" options={SEP_LABELS} value={sep} onChange={setSep} />
              <Choice label="Colonnes" options={LAYOUT_LABELS} value={layout} onChange={setLayout} />
              <Choice
                label="Première ligne"
                options={[
                  { value: 'auto' as HeaderChoice, label: 'Auto' },
                  { value: 'yes' as HeaderChoice, label: 'En-tête' },
                  { value: 'no' as HeaderChoice, label: 'Participant' },
                ]}
                value={header}
                onChange={setHeader}
              />
            </div>

            {result.rows.length === 0 ? (
              <div className="banner bad">
                Aucune personne reconnue. Vérifie le séparateur ci-dessus.
              </div>
            ) : (
              <>
                <table className="preview-table">
                  <thead>
                    <tr>
                      <th>Nom</th>
                      <th>Groupe</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.slice(0, PREVIEW_ROWS).map((r, i) => (
                      <tr key={i} className={r.duplicate ? 'dup' : ''}>
                        <td>{r.name}</td>
                        <td>
                          {r.group && (
                            <span className="chip">
                              <span className="dot" style={{ background: groupColor(r.group) }} />
                              {r.group}
                            </span>
                          )}
                        </td>
                        <td>{r.duplicate ? 'déjà dans la liste' : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {result.total > PREVIEW_ROWS && (
                  <p className="card-hint">
                    … et {result.total - PREVIEW_ROWS} autre
                    {result.total - PREVIEW_ROWS > 1 ? 's' : ''} ligne
                    {result.total - PREVIEW_ROWS > 1 ? 's' : ''}.
                  </p>
                )}

                {result.duplicates > 0 && (
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={withDuplicates}
                      onChange={(e) => setWithDuplicates(e.target.checked)}
                    />
                    Importer aussi {result.duplicates} nom{result.duplicates > 1 ? 's' : ''} déjà
                    présent{result.duplicates > 1 ? 's' : ''}
                  </label>
                )}
              </>
            )}
          </>
        )}

        <div className="generate-row">
          <button
            className="btn btn-primary"
            disabled={kept.length === 0}
            onClick={() => {
              onImport(kept.map(({ name, group }) => ({ name, group })))
              onClose()
            }}
          >
            {kept.length === 0
              ? 'Rien à importer'
              : `Importer ${kept.length} personne${kept.length > 1 ? 's' : ''}`}
          </button>
          <button className="btn btn-ghost" onClick={onClose}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  )
}
