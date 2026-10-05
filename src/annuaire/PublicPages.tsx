import { useEffect, useState, type ReactNode } from 'react'
import { api, ApiError, frDate, type EntryFields, type MyEntry, type PublicEvent } from './api'
import { CONSENT_VERSION, selfUrl } from './config'
import EntryForm from './EntryForm'
import Legal from './Legal'
import { LOGO_14_AVENUE_LIGHT } from '../logo'

function Shell({ kicker, title, children }: { kicker: string; title: string; children: ReactNode }) {
  return (
    <div className="public">
      <header className="public-head">
        <img className="public-logo" src={LOGO_14_AVENUE_LIGHT} alt="Le 14 Avenue" />
        <p className="public-kicker">{kicker}</p>
        <h1 className="public-title">{title}</h1>
      </header>
      <main className="public-body">{children}</main>
    </div>
  )
}

function errorText(err: unknown) {
  return err instanceof ApiError ? err.message : 'Une erreur est survenue. Réessayez dans un instant.'
}

function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="copy-link">
      <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="Lien personnel" />
      <button
        className="btn btn-primary"
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url)
            setCopied(true)
            setTimeout(() => setCopied(false), 1800)
          } catch {
            // Pas d'accès au presse-papiers : le champ reste sélectionnable.
          }
        }}
      >
        {copied ? 'Copié !' : 'Copier'}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------

/** Formulaire public : consentement et inscription à l'annuaire. */
export function SignupPage({ slug }: { slug: string }) {
  const [event, setEvent] = useState<PublicEvent | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    api.event(slug).then(setEvent, (err) => setLoadError(errorText(err)))
  }, [slug])

  if (loadError) {
    return (
      <Shell kicker="Annuaire des participants" title="Lien introuvable">
        <p className="public-text">{loadError}</p>
      </Shell>
    )
  }
  if (!event) {
    return (
      <Shell kicker="Annuaire des participants" title="Chargement…">
        <p className="public-text">Un instant.</p>
      </Shell>
    )
  }

  const kicker = `${event.title} · ${frDate(event.event_date)}`

  if (token) {
    return (
      <Shell kicker={kicker} title="C'est noté, merci !">
        <p className="public-text">
          Vous figurerez dans l'annuaire des participants, envoyé après la soirée à tous ceux qui
          ont rempli ce formulaire.
        </p>
        <div className="public-card">
          <h2>Gardez ce lien personnel</h2>
          <p>
            Il vous permet de modifier vos informations ou de retirer votre consentement à tout
            moment. Il ne vous sera pas renvoyé : copiez-le ou faites une capture d'écran.
          </p>
          <CopyLink url={selfUrl(token)} />
        </div>
      </Shell>
    )
  }

  if (!event.is_open) {
    return (
      <Shell kicker={kicker} title="Formulaire fermé">
        <p className="public-text">
          Le formulaire de l'annuaire n'est pas ouvert pour le moment. Revenez un peu plus tard, ou
          rapprochez-vous des organisateurs.
        </p>
      </Shell>
    )
  }

  async function submit(fields: EntryFields) {
    setBusy(true)
    setError(null)
    try {
      const { token } = await api.submit(slug, fields, CONSENT_VERSION)
      setToken(token)
      window.scrollTo({ top: 0 })
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Shell kicker={kicker} title="Rejoignez l'annuaire des participants">
      <p className="public-text">
        Après la soirée, nous enverrons à chaque participant qui a rempli ce formulaire l'annuaire
        des présents, pour garder le contact. Vous choisissez ce qui y figure.
      </p>
      {error && <div className="banner bad">{error}</div>}
      <EntryForm mode="create" submitLabel="Rejoindre l'annuaire" busy={busy} onSubmit={submit} />
      <Legal
        title={event.title}
        eventDate={event.event_date}
        controller={event.controller}
        contactEmail={event.contact_email}
        retentionUntil={event.retention_until}
      />
    </Shell>
  )
}

// ---------------------------------------------------------------------------

/** Espace personnel : modifier ses informations ou retirer son consentement. */
export function MyEntryPage({ token }: { token: string }) {
  const [entry, setEntry] = useState<MyEntry | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleted, setDeleted] = useState(false)

  useEffect(() => {
    api.me(token).then(setEntry, (err) => setLoadError(errorText(err)))
  }, [token])

  if (deleted) {
    return (
      <Shell kicker="Annuaire des participants" title="Inscription supprimée">
        <p className="public-text">
          Vos informations ont été effacées et vous ne figurerez plus dans l'annuaire. Les
          exemplaires déjà envoyés ne peuvent pas être rappelés.
        </p>
      </Shell>
    )
  }
  if (loadError) {
    return (
      <Shell kicker="Annuaire des participants" title="Lien introuvable">
        <p className="public-text">{loadError}</p>
      </Shell>
    )
  }
  if (!entry) {
    return (
      <Shell kicker="Annuaire des participants" title="Chargement…">
        <p className="public-text">Un instant.</p>
      </Shell>
    )
  }

  const ev = entry.event

  async function save(fields: EntryFields) {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await api.updateMe(token, fields, CONSENT_VERSION)
      setNotice('Vos informations sont à jour.')
      window.scrollTo({ top: 0 })
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    setError(null)
    try {
      await api.deleteMe(token)
      setDeleted(true)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Shell kicker={`${ev.title} · ${frDate(ev.event_date)}`} title="Vos informations">
      <p className="public-text">
        Inscription du {frDate(entry.consented_at)}. Modifiez ce qui figure dans l'annuaire, ou
        retirez votre consentement.
      </p>
      {notice && <div className="banner ok">{notice}</div>}
      {error && <div className="banner bad">{error}</div>}
      <EntryForm
        mode="edit"
        initial={entry}
        submitLabel="Enregistrer les modifications"
        busy={busy}
        onSubmit={save}
      />

      <div className="public-card danger">
        <h2>Retirer mon consentement</h2>
        <p>Vos informations seront définitivement effacées de l'annuaire.</p>
        {confirmDelete ? (
          <div className="danger-actions">
            <button className="btn btn-danger" onClick={remove} disabled={busy}>
              Oui, supprimer mon inscription
            </button>
            <button className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>
              Annuler
            </button>
          </div>
        ) : (
          <button className="btn" onClick={() => setConfirmDelete(true)}>
            Supprimer mon inscription
          </button>
        )}
      </div>

      <Legal
        title={ev.title}
        eventDate={ev.event_date}
        controller={ev.controller}
        contactEmail={ev.contact_email}
        retentionUntil={ev.retention_until}
      />
    </Shell>
  )
}
