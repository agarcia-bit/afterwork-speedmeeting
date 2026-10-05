import { useState } from 'react'
import type { EntryFields } from './api'

interface Props {
  initial?: EntryFields
  /** Inscription : la première case doit être cochée. Modification : elle l'est déjà. */
  mode: 'create' | 'edit'
  submitLabel: string
  busy: boolean
  onSubmit: (fields: EntryFields) => void
}

export const emptyFields: EntryFields = {
  first_name: '',
  last_name: '',
  activity: '',
  grp: '',
  email: '',
  phone: '',
  share_contact: false,
}

export default function EntryForm({ initial, mode, submitLabel, busy, onSubmit }: Props) {
  const [f, setF] = useState<EntryFields>(initial ?? emptyFields)
  const [consent, setConsent] = useState(mode === 'edit')
  const set = (patch: Partial<EntryFields>) => setF((prev) => ({ ...prev, ...patch }))

  return (
    <form
      className="entry-form"
      onSubmit={(e) => {
        e.preventDefault()
        if (consent) onSubmit(f)
      }}
    >
      <div className="form-row">
        <label className="form-field">
          <span>Prénom</span>
          <input
            required
            maxLength={80}
            autoComplete="given-name"
            value={f.first_name}
            onChange={(e) => set({ first_name: e.target.value })}
          />
        </label>
        <label className="form-field">
          <span>Nom</span>
          <input
            required
            maxLength={80}
            autoComplete="family-name"
            value={f.last_name}
            onChange={(e) => set({ last_name: e.target.value })}
          />
        </label>
      </div>

      <label className="form-field">
        <span>Activité</span>
        <input
          required
          maxLength={160}
          autoComplete="organization-title"
          placeholder="Ex. : fleuriste, expert-comptable, présidente d'association…"
          value={f.activity}
          onChange={(e) => set({ activity: e.target.value })}
        />
      </label>

      <label className="form-field">
        <span>
          Association ou groupe <em>facultatif</em>
        </span>
        <input
          maxLength={80}
          placeholder="Ex. : PAF, ARCOPRO, UCAP…"
          value={f.grp}
          onChange={(e) => set({ grp: e.target.value })}
        />
      </label>

      <div className="form-row">
        <label className="form-field">
          <span>Adresse mail</span>
          <input
            required
            type="email"
            maxLength={254}
            autoComplete="email"
            value={f.email}
            onChange={(e) => set({ email: e.target.value })}
          />
        </label>
        <label className="form-field">
          <span>
            Téléphone <em>facultatif</em>
          </span>
          <input
            type="tel"
            maxLength={30}
            autoComplete="tel"
            value={f.phone}
            onChange={(e) => set({ phone: e.target.value })}
          />
        </label>
      </div>

      <div className="consents">
        <label className="consent">
          <input
            type="checkbox"
            checked={consent}
            disabled={mode === 'edit'}
            onChange={(e) => setConsent(e.target.checked)}
          />
          <span>
            <b>J'accepte que mes prénom, nom, activité et association figurent dans l'annuaire</b>{' '}
            envoyé aux participants de la soirée ayant rempli ce formulaire.
            {mode === 'edit' && (
              <em className="consent-note">
                {' '}
                Pour retirer ce consentement, supprimez votre inscription ci-dessous.
              </em>
            )}
          </span>
        </label>
        <label className="consent">
          <input
            type="checkbox"
            checked={f.share_contact}
            onChange={(e) => set({ share_contact: e.target.checked })}
          />
          <span>
            <b>J'accepte que mon adresse mail et mon téléphone y figurent aussi</b>, pour que les
            autres participants puissent me contacter. <em>Facultatif.</em>
          </span>
        </label>
      </div>

      <button className="btn btn-primary form-submit" type="submit" disabled={busy || !consent}>
        {busy ? 'Envoi…' : submitLabel}
      </button>
    </form>
  )
}
