import { useMemo, useRef, useState } from 'react'
import type { Participant } from '../types'
import { fromCells, parseList, type Layout, type Separator } from '../import'
import { buildXlsx, readXlsx } from '../xlsx'
import { saveFile } from '../download'
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

/** Contenu du modèle : l'en-tête attendu, suivi de trois exemples à remplacer. */
const TEMPLATE_ROWS = [
  ['Nom', 'Groupe'],
  ['Marie Delcourt', 'PAF'],
  ['Paul Vasseur', 'ARCOPRO'],
  ['Sophie Leroy', ''],
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
  const [file, setFile] = useState<{ name: string; cells: string[][] } | null>(null)
  const [text, setText] = useState('')
  const [sep, setSep] = useState<SepChoice>('auto')
  const [layout, setLayout] = useState<LayoutChoice>('auto')
  const [header, setHeader] = useState<HeaderChoice>('auto')
  const [withDuplicates, setWithDuplicates] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const picker = useRef<HTMLInputElement>(null)

  const names = useMemo(() => participants.map((p) => p.name), [participants])

  const result = useMemo(() => {
    const options = {
      layout: layout === 'auto' ? undefined : layout,
      header: header === 'auto' ? undefined : header === 'yes',
    }
    return file
      ? fromCells(file.cells, names, options)
      : parseList(text, names, {
          ...options,
          separator: sep === 'auto' ? undefined : sep === 'none' ? null : sep,
        })
  }, [file, text, names, sep, layout, header])

  const hasInput = file !== null || text.trim() !== ''
  const kept = withDuplicates ? result.rows : result.rows.filter((r) => !r.duplicate)

  async function takeFile(f: File) {
    setError(null)
    const name = f.name.toLowerCase()
    try {
      if (name.endsWith('.xlsx')) {
        const cells = readXlsx(await f.arrayBuffer())
        if (cells.length === 0) {
          setError('Ce classeur ne contient aucune ligne.')
          return
        }
        setText('')
        setFile({ name: f.name, cells })
      } else if (name.endsWith('.xls')) {
        setError(
          "L'ancien format .xls ne peut pas être lu ici. Dans Excel, « Enregistrer sous » puis choisis .xlsx.",
        )
      } else {
        setFile(null)
        setText(await f.text())
      }
    } catch {
      setError("Fichier illisible. Vérifie qu'il s'agit bien d'un .xlsx, ou colle la liste ci-dessous.")
    }
  }

  async function downloadTemplate() {
    setError(null)
    const outcome = await saveFile('participants-modele.xlsx', buildXlsx(TEMPLATE_ROWS))
    if (outcome === 'declined') setError('Téléchargement refusé.')
    else if (outcome === 'unavailable')
      setError("Téléchargement impossible depuis cette page. Utilise plutôt le collage ci-dessous.")
  }

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="card-head">
          <h2 className="card-title">Importer des participants</h2>
          <button className="btn btn-icon" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </div>

        <p className="card-hint">
          Remplis le modèle Excel — une colonne <b>Nom</b>, une colonne <b>Groupe</b> — puis
          dépose-le ici. Rien n'est ajouté tant que tu n'as pas validé l'aperçu.
        </p>

        <div className="template-row">
          <button className="btn btn-sm" onClick={downloadTemplate}>
            Télécharger le modèle Excel
          </button>
        </div>

        {file ? (
          <div className="file-chip">
            <span className="file-name">{file.name}</span>
            <span className="file-meta">
              {file.cells.length} ligne{file.cells.length > 1 ? 's' : ''}
            </span>
            <button
              className="btn btn-icon"
              onClick={() => setFile(null)}
              aria-label="Retirer le fichier"
            >
              ×
            </button>
          </div>
        ) : (
          <div
            className={`dropzone${dragging ? ' over' : ''}`}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              const f = e.dataTransfer.files[0]
              if (f) void takeFile(f)
            }}
            onClick={() => picker.current?.click()}
          >
            <b>Dépose ton fichier ici</b>
            <span>ou clique pour le choisir — .xlsx ou .csv</span>
            <input
              ref={picker}
              type="file"
              accept=".xlsx,.csv,.txt"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void takeFile(f)
                e.target.value = ''
              }}
            />
          </div>
        )}

        {error && <div className="banner bad">{error}</div>}

        {!file && (
          <>
            <p className="or-line">ou colle ta liste</p>
            <textarea
              className="modal-text import-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={'Marie Delcourt ; PAF\nPaul Vasseur ; ARCOPRO\nSophie Leroy'}
            />
          </>
        )}

        {hasInput && (
          <>
            <div className="choices">
              {!file && (
                <Choice label="Séparateur" options={SEP_LABELS} value={sep} onChange={setSep} />
              )}
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
                Aucune personne reconnue. Vérifie les réglages ci-dessus.
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
