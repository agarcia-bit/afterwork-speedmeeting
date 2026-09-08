import { useState } from 'react'
import type { EventState } from '../types'
import { allSheetsPdf, sheetFilename, sheetPdf } from '../sheets'
import { saveFile } from '../download'

interface Props {
  state: EventState
  onImport: (json: string) => string | null
  onClose: () => void
}

/** Plan des rotations au format CSV, ouvrable dans Excel. */
export function toCsv(state: EventState): string {
  const byId = new Map(state.participants.map((p) => [p.id, p]))
  const rows = [['Rotation', 'Table', 'Nom', 'Groupe'].join(';')]
  state.rotations.forEach((rot, r) =>
    rot.forEach((table, t) =>
      table.forEach((id) => {
        const p = byId.get(id)
        if (p) rows.push([r + 1, t + 1, p.name, p.group].join(';'))
      }),
    ),
  )
  return rows.join('\n')
}

export default function DataModal({ state, onImport, onClose }: Props) {
  const [tab, setTab] = useState<'sheets' | 'json' | 'csv' | 'import'>('sheets')
  const [paste, setPaste] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [working, setWorking] = useState(false)

  const attendees = state.participants.filter((p) => p.present)
  const ready = state.rotations.length > 0 && attendees.length > 0

  async function saveAll() {
    setWorking(true)
    setProgress('Génération du PDF…')
    try {
      const outcome = await saveFile('fiches-speed-meeting.pdf', allSheetsPdf(state, attendees))
      setProgress(
        outcome === 'saved'
          ? `PDF enregistré — ${attendees.length} fiches.`
          : outcome === 'declined'
            ? 'Enregistrement refusé.'
            : "Enregistrement impossible depuis cette page.",
      )
    } finally {
      setWorking(false)
    }
  }

  async function saveEach() {
    setWorking(true)
    try {
      for (let i = 0; i < attendees.length; i++) {
        const p = attendees[i]
        setProgress(`${i + 1} / ${attendees.length} — ${p.name}`)
        const outcome = await saveFile(sheetFilename(p), sheetPdf(state, p))
        if (outcome !== 'saved') {
          setProgress(`Interrompu à ${p.name} — ${i} fiche${i > 1 ? 's' : ''} enregistrée${i > 1 ? 's' : ''}.`)
          return
        }
      }
      setProgress(`${attendees.length} fiches enregistrées.`)
    } finally {
      setWorking(false)
    }
  }

  const content = tab === 'csv' ? toCsv(state) : JSON.stringify(state, null, 2)

  async function copy() {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      setError("Copie impossible : sélectionne le texte et copie-le à la main.")
    }
  }

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="card-head">
          <h2 className="card-title">Sauvegarde &amp; export</h2>
          <button className="btn btn-icon" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </div>

        <div className="tabs">
          <button className={`btn btn-sm${tab === 'sheets' ? ' btn-primary' : ' btn-ghost'}`} onClick={() => setTab('sheets')}>
            Fiches PDF
          </button>
          <button className={`btn btn-sm${tab === 'json' ? ' btn-primary' : ' btn-ghost'}`} onClick={() => setTab('json')}>
            Sauvegarde JSON
          </button>
          <button className={`btn btn-sm${tab === 'csv' ? ' btn-primary' : ' btn-ghost'}`} onClick={() => setTab('csv')}>
            Plan CSV
          </button>
          <button className={`btn btn-sm${tab === 'import' ? ' btn-primary' : ' btn-ghost'}`} onClick={() => setTab('import')}>
            Restaurer
          </button>
        </div>

        {tab === 'sheets' ? (
          <div className="sheets-pane">
            <p className="card-hint">
              Une page A5 par personne : son nom, son groupe, sa table à chaque rotation et les
              personnes qu'elle y retrouvera. Prête à joindre à un mail.
            </p>
            {!ready ? (
              <p className="empty">Génère d'abord les rotations.</p>
            ) : (
              <>
                <div className="sheet-actions">
                  <button className="btn btn-primary" onClick={saveAll} disabled={working}>
                    Toutes les fiches — 1 PDF de {attendees.length} pages
                  </button>
                  <button className="btn" onClick={saveEach} disabled={working}>
                    Un PDF par personne — {attendees.length} fichiers
                  </button>
                </div>
                <p className="card-hint">
                  Les fichiers séparés sont nommés « fiche-prenom-nom.pdf ». Selon le navigateur,
                  chaque enregistrement demande une confirmation.
                </p>
                {progress && <div className="banner warn">{progress}</div>}
              </>
            )}
          </div>
        ) : tab === 'import' ? (
          <>
            <p className="card-hint" style={{ margin: '12px 0' }}>
              Colle ici une sauvegarde JSON pour remplacer la soirée en cours.
            </p>
            <textarea
              className="modal-text"
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              placeholder='{ "participants": [...] }'
            />
            {error && <div className="banner bad" style={{ marginTop: 12 }}>{error}</div>}
            <div className="generate-row">
              <button
                className="btn btn-primary"
                onClick={() => {
                  const err = onImport(paste)
                  if (err) setError(err)
                  else onClose()
                }}
              >
                Charger
              </button>
            </div>
          </>
        ) : (
          <>
            <textarea className="modal-text" value={content} readOnly onFocus={(e) => e.currentTarget.select()} />
            {error && <div className="banner bad" style={{ marginTop: 12 }}>{error}</div>}
            <div className="generate-row">
              <button className="btn btn-primary" onClick={copy}>
                {copied ? 'Copié !' : 'Copier'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
