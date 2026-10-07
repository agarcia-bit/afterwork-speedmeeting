import { useEffect, useRef, useState, type ReactNode } from 'react'
import { api, ApiError, frDate, type EntryFields, type MyEntry, type PublicEvent } from './api'
import { CONSENT_VERSION, selfUrl } from './config'
import EntryForm, { type InvalidField } from './EntryForm'
import Legal from './Legal'
import { AGALUMY_ICON, LOGO_14_AVENUE_LIGHT } from '../logo'
import { useSequence } from './motion'
import SplitText from './SplitText'
import Embers, { type EmbersHandle } from './Embers'
import './public.css'

/** Titre de la page : la marque de la soirée, le remerciement, ou un titre simple. */
type Hero =
  | { kind: 'brand'; subtitle: string }
  | { kind: 'thanks' }
  | { kind: 'plain'; title: string }
  | { kind: 'loading' }

function HeroTitle({ hero }: { hero: Hero }) {
  if (hero.kind === 'brand') {
    return (
      <>
        <h1 className="hero" aria-label="Afterwork Speed meeting">
          <SplitText className="hero-line1" text="Afterwork" />
          <span className="hero-line2">Speed meeting</span>
        </h1>
        <p className="public-sub">{hero.subtitle}</p>
      </>
    )
  }
  if (hero.kind === 'thanks') {
    return (
      <h1 className="hero hero-thanks" aria-label="Merci d'avoir participé !">
        <SplitText className="hero-line1" text="Merci" />
        <span className="hero-line2">d'avoir participé !</span>
      </h1>
    )
  }
  if (hero.kind === 'plain') return <h1 className="public-title">{hero.title}</h1>
  return null
}

/**
 * Attente du serveur. Rien ne s'affiche à part les braises qui s'allument :
 * un logo montré pendant l'attente disparaissait à l'arrivée des données,
 * juste avant l'ouverture animée, et faisait l'effet d'un clignotement. Un mot
 * apparaît seulement si l'attente traîne vraiment.
 */
function LoadingScreen() {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 4000)
    return () => window.clearTimeout(timer)
  }, [])
  return (
    <div className="public vitrine public-loading" role="status" aria-live="polite" aria-label="Chargement">
      {slow && <p className="public-text loading-slow">Connexion un peu lente…</p>}
    </div>
  )
}

/** Durées des séquences, alignées sur les délais de public.css. */
const SEQUENCE_MS = { brand: 2300, thanks: 3700 }

type ShellProps = {
  kicker: string
  hero: Hero
  /** Mise en scène réservée à la page d'inscription : braises, halo, animations. */
  vitrine?: boolean
  children?: ReactNode
}

// Une page par état : changer d'état remonte la page, et rejoue la séquence
// qui lui correspond (ouverture de marque, remerciement), jamais l'autre.
// Les braises vivent au-dessus de ces états : elles persistent d'une page à
// l'autre, et c'est d'elles que part la gerbe du remerciement.
function Shell(props: ShellProps) {
  const embers = useRef<EmbersHandle>(null)
  useEffect(() => {
    if (props.hero.kind === 'thanks') embers.current?.burst()
  }, [props.hero.kind])

  return (
    <>
      {props.vitrine && <Embers ref={embers} />}
      <ShellPage key={props.hero.kind} {...props} />
    </>
  )
}

function ShellPage(props: ShellProps) {
  return props.hero.kind === 'loading' ? <LoadingScreen /> : <ContentPage {...props} />
}

function ContentPage({ kicker, hero, vitrine, children }: ShellProps) {
  const playing = useSequence(
    hero.kind === 'brand'
      ? { duration: SEQUENCE_MS.brand, once: 'annuaire-intro-vue' }
      : hero.kind === 'thanks'
        ? { duration: SEQUENCE_MS.thanks }
        : { duration: 0, enabled: false },
  )
  const sequence = playing ? (hero.kind === 'brand' ? ' intro' : ' outro') : ''

  return (
    <div className={`public${vitrine ? ' vitrine' : ''}${sequence}`}>
      {vitrine && <div className="public-glow" aria-hidden="true" />}
      <header className="public-head">
        <img className="public-logo" src={LOGO_14_AVENUE_LIGHT} alt="Le 14 Avenue" />
        <p className="public-kicker">{kicker}</p>
        <HeroTitle hero={hero} />
      </header>
      {children && <main className="public-body">{children}</main>}
      {vitrine && <Credit />}
    </div>
  )
}

/** Lien suivi : permet de mesurer, côté Agalumy, les visites venues de la soirée. */
const AGALUMY_URL =
  'https://www.agalumy.fr/?utm_source=afterwork-interasso&utm_medium=formulaire&utm_campaign=signature'

/**
 * Signature de la page : ceux qui la remplissent viennent de la voir à
 * l'œuvre, c'est le meilleur moment pour leur dire qui l'a faite.
 */
function Credit() {
  return (
    <footer className="public-credit">
      <a className="credit-card" href={AGALUMY_URL} target="_blank" rel="noopener">
        <img className="credit-logo" src={AGALUMY_ICON} alt="" width={48} height={46} />
        <span className="credit-text">
          <span className="credit-kicker">Par Agalumy</span>
          <span className="credit-title">Envie d'une page comme celle-ci ?</span>
          <span className="credit-sub">Rendre l'IA simple et utile</span>
        </span>
        <span className="credit-arrow" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M5 12h13M13 6l6 6-6 6" />
          </svg>
        </span>
      </a>
    </footer>
  )
}

/** « INTERASSO · 6 octobre 2026 » : le titre géant dit déjà « Afterwork ». */
function eventKicker(title: string, date: string) {
  const short = title.replace(/^\s*afterwork\s*/i, '').trim() || title
  return `${short} · ${frDate(date)}`
}

// La requête de la soirée part dès le chargement du script, sans attendre
// le premier rendu : chaque milliseconde gagnée raccourcit l'attente.
const eventRequests = new Map<string, Promise<PublicEvent>>()

export function prefetchEvent(slug: string): Promise<PublicEvent> {
  let request = eventRequests.get(slug)
  if (!request) {
    request = api.event(slug)
    // Évite un avertissement « promesse rejetée non gérée » avant le rendu.
    request.catch(() => {})
    eventRequests.set(slug, request)
  }
  return request
}

function errorText(err: unknown) {
  return err instanceof ApiError ? err.message : 'Une erreur est survenue. Réessayez dans un instant.'
}

/** Champ à signaler pour une erreur renvoyée par la base, s'il y en a un. */
function fieldFor(err: unknown): InvalidField | null {
  if (!(err instanceof ApiError)) return null
  switch (err.code) {
    case 'entries_email':
    case 'deja_inscrit':
      return 'email'
    case 'entries_names':
      return 'names'
    case 'entries_activity':
      return 'activity'
    case 'entries_phone':
      return 'phone'
    default:
      return null
  }
}

/** Erreur de formulaire : texte, champ concerné, et horodatage pour rejouer
 *  la secousse même quand le message ne change pas. */
function useFormError() {
  const [error, setError] = useState<{ text: string; field: InvalidField | null; at: number } | null>(
    null,
  )
  return {
    error,
    report: (err: unknown) => setError({ text: errorText(err), field: fieldFor(err), at: Date.now() }),
    clear: () => setError(null),
  }
}

function ErrorBanner({ error }: { error: { text: string; at: number } | null }) {
  return error ? (
    <div key={error.at} className="banner bad" role="alert">
      {error.text}
    </div>
  ) : null
}

function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  const field = useRef<HTMLInputElement>(null)

  // Presse-papiers moderne d'abord ; sinon copie classique depuis le champ ;
  // à défaut, le lien reste sélectionné pour une copie manuelle.
  async function copy() {
    let ok = false
    try {
      await navigator.clipboard.writeText(url)
      ok = true
    } catch {
      field.current?.select()
      try {
        ok = document.execCommand('copy')
      } catch {
        ok = false
      }
    }
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } else {
      field.current?.select()
    }
  }

  return (
    <div className="copy-link">
      <input
        ref={field}
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        aria-label="Lien personnel"
      />
      <button
        className={`btn btn-primary copy-btn${copied ? ' is-copied' : ''}`}
        type="button"
        onClick={copy}
      >
        {copied ? (
          <>
            <svg className="copy-check" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
            Copié !
          </>
        ) : (
          'Copier'
        )}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------

/** Formulaire public : consentement et inscription à l'annuaire. */
export function SignupPage({ slug }: { slug: string }) {
  const [event, setEvent] = useState<PublicEvent | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const { error, report, clear } = useFormError()
  const [busy, setBusy] = useState(false)
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    prefetchEvent(slug).then(setEvent, (err) => setLoadError(errorText(err)))
  }, [slug])

  if (loadError) {
    return (
      <Shell vitrine kicker="Annuaire des participants" hero={{ kind: 'plain', title: 'Lien introuvable' }}>
        <p className="public-text">{loadError}</p>
      </Shell>
    )
  }
  if (!event) {
    return (
      <Shell vitrine kicker="" hero={{ kind: 'loading' }} />
    )
  }

  const kicker = eventKicker(event.title, event.event_date)

  if (token) {
    return (
      <Shell vitrine kicker={kicker} hero={{ kind: 'thanks' }}>
        <p className="public-text">
          Vous recevrez par mail l'annuaire des participants après la soirée, et vous y figurerez
          avec ce que vous avez choisi de partager.
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
      <Shell vitrine kicker={kicker} hero={{ kind: 'brand', subtitle: 'Le formulaire ouvrira bientôt' }}>
        <p className="public-text">
          Le formulaire pour recevoir les contacts de la soirée n'est pas encore ouvert. Revenez un
          peu plus tard, ou rapprochez-vous des organisateurs.
        </p>
      </Shell>
    )
  }

  async function submit(fields: EntryFields) {
    setBusy(true)
    clear()
    try {
      const { token } = await api.submit(slug, fields, CONSENT_VERSION)
      setToken(token)
      window.scrollTo({ top: 0 })
    } catch (err) {
      report(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Shell vitrine kicker={kicker} hero={{ kind: 'brand', subtitle: 'Récupérez les contacts de la soirée' }}>
      <p className="public-text">
        Remplissez ce formulaire et recevez par mail, après la soirée, l'annuaire de tous ceux qui
        l'ont rempli : qui ils sont, ce qu'ils font, et comment les joindre quand ils l'acceptent.
        Vous choisissez ce que vous partagez en retour.
      </p>
      <ErrorBanner error={error} />
      <EntryForm
        vitrine
        mode="create"
        submitLabel="Recevoir les contacts"
        busy={busy}
        onSubmit={submit}
        invalid={error?.field ? { field: error.field, at: error.at } : null}
      />
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
  const { error, report, clear } = useFormError()
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleted, setDeleted] = useState(false)

  useEffect(() => {
    api.me(token).then(setEntry, (err) => setLoadError(errorText(err)))
  }, [token])

  if (deleted) {
    return (
      <Shell kicker="Annuaire des participants" hero={{ kind: 'plain', title: 'Inscription supprimée' }}>
        <p className="public-text">
          Vos informations ont été effacées et vous ne figurerez plus dans l'annuaire. Les
          exemplaires déjà envoyés ne peuvent pas être rappelés.
        </p>
      </Shell>
    )
  }
  if (loadError) {
    return (
      <Shell kicker="Annuaire des participants" hero={{ kind: 'plain', title: 'Lien introuvable' }}>
        <p className="public-text">{loadError}</p>
      </Shell>
    )
  }
  if (!entry) {
    return (
      <Shell kicker="Annuaire des participants" hero={{ kind: 'plain', title: 'Chargement…' }}>
        <p className="public-text">Un instant.</p>
      </Shell>
    )
  }

  const ev = entry.event

  async function save(fields: EntryFields) {
    setBusy(true)
    clear()
    setNotice(null)
    try {
      await api.updateMe(token, fields, CONSENT_VERSION)
      setNotice('Vos informations sont à jour.')
      window.scrollTo({ top: 0 })
    } catch (err) {
      report(err)
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    clear()
    try {
      await api.deleteMe(token)
      setDeleted(true)
    } catch (err) {
      report(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Shell kicker={`${ev.title} · ${frDate(ev.event_date)}`} hero={{ kind: 'plain', title: 'Vos informations' }}>
      <p className="public-text">
        Inscription du {frDate(entry.consented_at)}. Modifiez ce qui figure dans l'annuaire, ou
        retirez votre consentement.
      </p>
      {notice && <div className="banner ok">{notice}</div>}
      <ErrorBanner error={error} />
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
