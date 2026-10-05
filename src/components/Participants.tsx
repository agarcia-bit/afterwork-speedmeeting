import { useMemo, useState } from 'react'
import type { Participant } from '../types'
import { groupColor } from '../colors'
import ImportModal from './ImportModal'

interface Props {
  participants: Participant[]
  onAdd: (name: string, group: string) => void
  onAddMany: (rows: { name: string; group: string }[]) => void
  onUpdate: (id: string, patch: Partial<Participant>) => void
  onRemove: (id: string) => void
  onClearAll: () => void
}

/** Jeu d'essai : les cinq associations de l'affiche, pour découvrir l'outil. */
const DEMO: { name: string; group: string }[] = [
  ['Marie Delcourt', 'PAF'], ['Paul Vasseur', 'PAF'], ['Sophie Leroy', 'PAF'],
  ['Julien Mercier', 'PAF'], ['Claire Dubois', 'PAF'],
  ['Thomas Fournier', 'ARCOPRO'], ['Émilie Garnier', 'ARCOPRO'], ['Nicolas Roussel', 'ARCOPRO'],
  ['Laura Ibrahim', 'ARCOPRO'], ['Antoine Jacquet', 'ARCOPRO'],
  ['Céline Marchand', 'Enseignes de Marcq'], ['Rémi Noël', 'Enseignes de Marcq'],
  ['Alice Ollivier', 'Enseignes de Marcq'], ['Hugo Payet', 'Enseignes de Marcq'],
  ['Léa Quentin', 'UCAP'], ['Vincent Renard', 'UCAP'], ['Manon Sauvage', 'UCAP'],
  ['Olivier Tanguy', 'UCAP'], ['Sarah Ubaldi', 'UCAP'],
  ['David Vidal', 'ACAEM'], ['Nadia Wahl', 'ACAEM'], ['Franck Xavier', 'ACAEM'],
  ['Camille Keller', 'ACAEM'], ['Maxime Lambert', 'ACAEM'],
].map(([name, group]) => ({ name, group }))

export default function Participants({
  participants,
  onAdd,
  onAddMany,
  onUpdate,
  onRemove,
  onClearAll,
}: Props) {
  const [name, setName] = useState('')
  const [group, setGroup] = useState('')
  const [importing, setImporting] = useState(false)
  // Effacer toute la liste supprime aussi le tirage : on demande confirmation
  // sur place, par un second clic.
  const [confirmClear, setConfirmClear] = useState(false)

  const groups = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of participants) {
      if (!p.present) continue
      const g = p.group.trim()
      if (g) counts.set(g, (counts.get(g) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  }, [participants])

  const presentCount = participants.filter((p) => p.present).length

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onAdd(trimmed, group.trim())
    setName('')
    // Le groupe reste en place : on saisit souvent une asso d'affilée.
  }

  return (
    <section className="card">
      <div className="card-head">
        <h2 className="card-title">Participants</h2>
        <div className="head-right">
          <span className="card-hint">
            {presentCount} présent{presentCount > 1 ? 's' : ''}
            {participants.length !== presentCount ? ` / ${participants.length}` : ''}
            {groups.length > 0 ? ` · ${groups.length} groupe${groups.length > 1 ? 's' : ''}` : ''}
          </span>
          {participants.length > 0 &&
            (confirmClear ? (
              <>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => {
                    onClearAll()
                    setConfirmClear(false)
                  }}
                >
                  Tout effacer ?
                </button>
                <button className="btn btn-sm btn-ghost" onClick={() => setConfirmClear(false)}>
                  Annuler
                </button>
              </>
            ) : (
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => setConfirmClear(true)}
                title="Vider la liste et effacer le tirage"
              >
                Tout effacer
              </button>
            ))}
        </div>
      </div>

      <form className="add-form" onSubmit={submit}>
        <input
          type="text"
          placeholder="Nom"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Nom du participant"
        />
        <input
          type="text"
          placeholder="Groupe (optionnel)"
          list="known-groups"
          value={group}
          onChange={(e) => setGroup(e.target.value)}
          aria-label="Groupe du participant"
        />
        <button type="submit" className="btn btn-primary">
          Ajouter
        </button>
      </form>

      <div className="import-row">
        <button className="btn btn-sm btn-ghost" onClick={() => setImporting(true)}>
          Importer une liste (tableur, mail…)
        </button>
      </div>

      <datalist id="known-groups">
        {groups.map(([g]) => (
          <option key={g} value={g} />
        ))}
      </datalist>

      {groups.length > 0 && (
        <div className="legend">
          {groups.map(([g, n]) => (
            <span className="chip" key={g}>
              <span className="dot" style={{ background: groupColor(g) }} />
              {g} <b>{n}</b>
            </span>
          ))}
        </div>
      )}

      <div className="people">
        {participants.length === 0 && (
          <div className="empty">
            <p style={{ margin: '0 0 12px' }}>
              Aucun participant. Ajoute-les un par un, colle ta liste,
              <br />
              ou pars d'un exemple pour voir comment ça tourne.
            </p>
            <button className="btn btn-sm" onClick={() => onAddMany(DEMO)}>
              Charger un exemple — 24 personnes, 5 associations
            </button>
          </div>
        )}
        {participants.map((p) => (
          <div className={`person${p.present ? '' : ' absent'}`} key={p.id}>
            <span className="dot" style={{ background: groupColor(p.group) }} />
            <input
              type="text"
              value={p.name}
              onChange={(e) => onUpdate(p.id, { name: e.target.value })}
              aria-label="Nom"
            />
            <input
              type="text"
              className="group-input"
              list="known-groups"
              placeholder="—"
              value={p.group}
              onChange={(e) => onUpdate(p.id, { group: e.target.value })}
              aria-label="Groupe"
            />
            <button
              className="toggle"
              data-on={p.present}
              onClick={() => onUpdate(p.id, { present: !p.present })}
              title={p.present ? 'Présent — cliquer pour marquer absent' : 'Absent — cliquer pour marquer présent'}
              aria-label={p.present ? 'Marquer absent' : 'Marquer présent'}
            />
            <button className="btn btn-icon" onClick={() => onRemove(p.id)} title="Retirer" aria-label="Retirer">
              ×
            </button>
          </div>
        ))}
      </div>

      {importing && (
        <ImportModal
          participants={participants}
          onImport={onAddMany}
          onClose={() => setImporting(false)}
        />
      )}
    </section>
  )
}
