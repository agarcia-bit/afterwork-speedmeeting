import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { EntryFields } from './api'

/** Champ désigné par une erreur renvoyée par la base. */
export type InvalidField = 'names' | 'activity' | 'email' | 'phone'

interface Props {
  initial?: EntryFields
  /** Inscription : la première case doit être cochée. Modification : elle l'est déjà. */
  mode: 'create' | 'edit'
  submitLabel: string
  busy: boolean
  onSubmit: (fields: EntryFields) => void
  /** Dernière erreur rattachée à un champ ; `at` change à chaque nouvelle erreur. */
  invalid?: { field: InvalidField; at: number } | null
  /** Habillage de la page d'inscription (coches dessinées, reflet, erreurs ciblées). */
  vitrine?: boolean
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

/** Case de consentement : la vraie case reste là pour le clavier et les
 *  lecteurs d'écran, la coche dessinée n'est qu'un habillage. */
function Consent({
  checked,
  disabled,
  onChange,
  children,
  drawn,
}: {
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
  children: ReactNode
  drawn: boolean
}) {
  if (!drawn) {
    return (
      <label className="consent">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span>{children}</span>
      </label>
    )
  }
  return (
    <label className={`consent${checked ? ' is-checked' : ''}${disabled ? ' is-locked' : ''}`}>
      <input
        type="checkbox"
        className="consent-input"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="consent-box" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </span>
      <span className="consent-text">{children}</span>
    </label>
  )
}

export default function EntryForm({
  initial,
  mode,
  submitLabel,
  busy,
  onSubmit,
  invalid,
  vitrine = false,
}: Props) {
  const [f, setF] = useState<EntryFields>(initial ?? emptyFields)
  const [consent, setConsent] = useState(mode === 'edit')
  const [bad, setBad] = useState<InvalidField | null>(null)
  const [shine, setShine] = useState(false)
  const shone = useRef(mode === 'edit' || !vitrine)

  // Une nouvelle erreur signale son champ, jusqu'à ce qu'on le corrige.
  useEffect(() => setBad(invalid?.field ?? null), [invalid?.at, invalid?.field])

  // Reflet sur le bouton, une seule fois, quand il devient utilisable.
  useEffect(() => {
    if (consent && !shone.current) {
      shone.current = true
      setShine(true)
    }
  }, [consent])

  const set = (patch: Partial<EntryFields>) => {
    setF((prev) => ({ ...prev, ...patch }))
    const touched: InvalidField | null =
      'first_name' in patch || 'last_name' in patch
        ? 'names'
        : 'activity' in patch
          ? 'activity'
          : 'email' in patch
            ? 'email'
            : 'phone' in patch
              ? 'phone'
              : null
    if (touched && touched === bad) setBad(null)
  }
  const field = (name: InvalidField) => `form-field${vitrine && bad === name ? ' invalid' : ''}`

  return (
    <form
      className="entry-form"
      onSubmit={(e) => {
        e.preventDefault()
        if (consent) onSubmit(f)
      }}
    >
      <div className="form-row">
        <label className={field('names')}>
          <span>Prénom</span>
          <input
            required
            maxLength={80}
            autoComplete="given-name"
            value={f.first_name}
            onChange={(e) => set({ first_name: e.target.value })}
          />
        </label>
        <label className={field('names')}>
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

      <label className={field('activity')}>
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
        <label className={field('email')}>
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
        <label className={field('phone')}>
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
        <Consent drawn={vitrine} checked={consent} disabled={mode === 'edit'} onChange={setConsent}>
          <b>J'accepte que mes prénom, nom, activité et association figurent dans l'annuaire</b>{' '}
          envoyé aux participants de la soirée ayant rempli ce formulaire.
          {mode === 'edit' && (
            <em className="consent-note">
              {' '}
              Pour retirer ce consentement, supprimez votre inscription ci-dessous.
            </em>
          )}
        </Consent>
        <Consent drawn={vitrine} checked={f.share_contact} onChange={(v) => set({ share_contact: v })}>
          <b>J'accepte que mon adresse mail et mon téléphone y figurent aussi</b>, pour que les
          autres participants puissent me contacter. <em>Facultatif.</em>
        </Consent>
      </div>

      <button
        className={`btn btn-primary form-submit${shine ? ' shine' : ''}`}
        type="submit"
        disabled={busy || !consent}
        onAnimationEnd={(e) => e.pseudoElement === '::after' && setShine(false)}
      >
        {busy ? 'Envoi…' : submitLabel}
      </button>
    </form>
  )
}
