import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { api, ApiError, type ReaderDirectory, type ReaderEntry } from './api'
import { ENGAGEMENT_TEXT, ENGAGEMENT_VERSION } from './config'
import { Credit, eventKicker, prefetchEvent } from './PublicPages'
import Embers from './Embers'
import SplitText from './SplitText'
import { prefersReducedMotion, useSequence } from './motion'
import { buildOneVcf, buildVcf, shareableCount } from './vcard'
import { byName, formatEntry, formatFirstName, formatPhone } from './contactFormat'
import { groupColor } from '../colors'
import { directoryPdf } from '../listing'
import { saveFile } from '../download'
import { LOGO_14_AVENUE_LIGHT } from '../logo'
import './public.css'
import './directory.css'

const EMAIL_KEY = 'annuaire-lecteur-email'
/** Durée de l'ouverture : titre, puis livre qui s'ouvre, puis formulaire. */
const INTRO_MS = 3900
/** Fiches qui s'envolent du livre vers le téléphone. */
const FLYING = 7

type Stage = 'login' | 'engage' | 'flight' | 'ready'

function errorText(err: unknown) {
  return err instanceof ApiError ? err.message : 'Une erreur est survenue. Réessayez dans un instant.'
}

const initials = (e: Pick<ReaderEntry, 'first_name' | 'last_name'>) =>
  `${e.first_name.trim()[0] ?? ''}${e.last_name.trim()[0] ?? ''}`.toUpperCase()

// ---------------------------------------------------------------------------
// Le livre

/** Lignes décoratives d'une page de l'annuaire. */
function PageLines({ count, from = 0 }: { count: number; from?: number }) {
  return (
    <div className="book-lines">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="book-line" style={{ '--k': i + from } as CSSProperties}>
          <i />
          <b />
        </span>
      ))}
    </div>
  )
}

function Book({ intro, title, date }: { intro: boolean; title: string; date: string }) {
  return (
    <div className="book-wrap" aria-hidden="true">
      <div className={`book${intro ? ' is-intro' : ''}`}>
        <div className="book-back" />
        <div className="book-block">
          <div className="book-page-right">
            <span className="book-page-title">Participants</span>
            <PageLines count={7} />
          </div>
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} className={`book-leaf leaf-${i}`}>
            {i === 2 && (
              <div className="book-page-left">
                <span className="book-page-title">Afterwork</span>
                <PageLines count={7} from={3} />
              </div>
            )}
          </div>
        ))}
        <div className="book-cover">
          <div className="cover-front">
            <img src={LOGO_14_AVENUE_LIGHT} alt="" />
            <span className="cover-kicker">Annuaire</span>
            <span className="cover-title">{title}</span>
            <span className="cover-date">{date}</span>
          </div>
          <div className="cover-inside" />
        </div>
        <div className="book-glow" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// L'envol des fiches vers le téléphone

function Flight({
  data,
  title,
  date,
  onDone,
}: {
  data: ReaderDirectory
  title: string
  date: string
  onDone: () => void
}) {
  const stage = useRef<HTMLDivElement>(null)
  const others = data.entries.filter((e) => e.id !== data.me)
  const flying = others.slice(0, FLYING)
  const total = shareableCount(data.entries, data.me)
  const [counter, setCounter] = useState(0)
  const [done, setDone] = useState(false)

  useLayoutEffect(() => {
    const root = stage.current
    if (!root) return
    if (prefersReducedMotion()) {
      setCounter(total)
      setDone(true)
      const t = window.setTimeout(onDone, 600)
      return () => window.clearTimeout(t)
    }

    // Toute la scène doit tenir à l'écran, téléphone compris.
    const box = root.getBoundingClientRect()
    const top = box.top + window.scrollY
    const want = Math.min(top - 8, top + box.height - window.innerHeight + 16)
    window.scrollTo({ top: Math.max(0, want), behavior: 'smooth' })

    const base = root.getBoundingClientRect()
    const page = root.querySelector('.book-page-right')!.getBoundingClientRect()
    const cards = Array.from(root.querySelectorAll<HTMLElement>('.fly-card'))
    const anims: Animation[] = []
    const rows = Array.from(root.querySelectorAll<HTMLElement>('.phone-row'))
    const start = 700 // le téléphone monte d'abord
    const step = 190
    const flightMs = 950

    cards.forEach((card, i) => {
      const w = card.offsetWidth
      const h = card.offsetHeight
      const x0 = page.left - base.left + page.width / 2 - w / 2
      const y0 = page.top - base.top + page.height / 2 - h / 2
      card.style.left = `${x0}px`
      card.style.top = `${y0}px`
      const target = rows[i].getBoundingClientRect()
      const dx = target.left - base.left + target.width / 2 - (x0 + w / 2)
      const dy = target.top - base.top + target.height / 2 - (y0 + h / 2)
      const side = i % 2 === 0 ? -1 : 1
      anims.push(card.animate(
        [
          { transform: 'translate(0, 6px) scale(0.5) rotate(-8deg)', opacity: 0 },
          { transform: 'translate(0, -18px) scale(1) rotate(-3deg)', opacity: 1, offset: 0.18 },
          {
            transform: `translate(${dx * 0.5 + side * 46}px, ${dy * 0.3 - 30}px) scale(1) rotate(${side * 7}deg)`,
            opacity: 1,
            offset: 0.58,
          },
          { transform: `translate(${dx}px, ${dy}px) scale(0.42) rotate(0deg)`, opacity: 0 },
        ],
        { duration: flightMs, delay: start + i * step, easing: 'cubic-bezier(0.45, 0, 0.25, 1)', fill: 'both' },
      ))
      anims.push(rows[i].animate(
        [
          { opacity: 0, transform: 'translateX(-10px)' },
          { opacity: 1, transform: 'none' },
        ],
        { duration: 280, delay: start + i * step + flightMs - 120, easing: 'ease-out', fill: 'both' },
      ))
    })

    // Le compteur suit les arrivées, puis file jusqu'au total.
    const first = start + flightMs - 120
    const last = start + (cards.length - 1) * step + flightMs
    const timers: number[] = []
    const ticks = Math.max(1, total)
    for (let k = 1; k <= ticks; k++) {
      timers.push(window.setTimeout(() => setCounter(k), first + ((last - first) * k) / ticks))
    }
    timers.push(window.setTimeout(() => setDone(true), last + 150))
    timers.push(window.setTimeout(onDone, last + 1500))
    return () => {
      timers.forEach((t) => window.clearTimeout(t))
      anims.forEach((a) => a.cancel())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flight" ref={stage} role="status" aria-live="polite">
      <div className="flight-book">
        <Book intro={false} title={title} date={date} />
      </div>

      <div className="phone">
        <div className="phone-notch" />
        <div className="phone-screen">
          <div className="phone-head">
            <span>Contacts</span>
            <span className={`phone-badge${done ? ' is-done' : ''}`}>+{counter}</span>
          </div>
          {flying.map((e) => (
            <div className="phone-row" key={e.id}>
              <span className="phone-avatar" style={{ background: groupColor(e.grp) }}>
                {initials(e)}
              </span>
              <span className="phone-name">
                {e.first_name} {e.last_name}
              </span>
            </div>
          ))}
          {others.length > flying.length && (
            <div className="phone-more">et {others.length - flying.length} autres…</div>
          )}
          <div className={`phone-ready${done ? ' is-done' : ''}`}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
            Annuaire prêt
          </div>
        </div>
      </div>

      {flying.map((e) => (
        <div className="fly-card" key={e.id} aria-hidden="true">
          <span className="phone-avatar" style={{ background: groupColor(e.grp) }}>
            {initials(e)}
          </span>
          <span className="fly-text">
            <b>
              {e.first_name} {e.last_name}
            </b>
            <i>{e.activity}</i>
          </span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// L'annuaire

const VCF_NAME = 'contacts-afterwork-interasso.vcf'

/** iPhone et iPad (y compris iPadOS, qui se présente comme un Mac tactile). */
const isIOS = () =>
  /iP(hone|ad|od)/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const isAndroid = () => /Android/i.test(navigator.userAgent)

function Directory({ data, name, slug }: { data: ReaderDirectory; name: string; slug: string }) {
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [ios] = useState(isIOS)
  const [android] = useState(isAndroid)
  const contacts = shareableCount(data.entries, data.me)
  const [y, m, d] = data.event_date.split('-').map(Number)
  const ctx = {
    title: data.title,
    date: new Date(y, m - 1, d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
  }

  const list = useMemo(() => {
    const q = query
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
    if (!q) return data.entries
    return data.entries.filter((e) =>
      `${e.first_name} ${e.last_name} ${e.activity} ${e.grp}`
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .includes(q),
    )
  }, [data.entries, query])

  async function addContacts() {
    const vcf = buildVcf(data.entries, data.me, ctx)
    if (ios) {
      // Ouvert depuis Safari, un fichier de plusieurs fiches n'en montre que la
      // première. Le menu Partager le confie à Contacts (ou à Fichiers), qui
      // proposent « Ajouter les N contacts ».
      const file = new File([vcf], VCF_NAME, { type: 'text/vcard' })
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file] })
        } catch (err) {
          if ((err as DOMException).name !== 'AbortError') {
            setNotice("Le partage n'a pas abouti. Réessayez, ou ajoutez les contacts un par un depuis leur fiche.")
          }
        }
        return
      }
      // Sans partage de fichiers : enregistré dans Fichiers › Téléchargements,
      // plutôt qu'ouvert (et tronqué) par Safari.
      const outcome = await saveFile(VCF_NAME, new Blob([vcf], { type: 'application/octet-stream' }))
      if (outcome === 'saved') {
        setNotice(
          `Ouvrez l'app Fichiers › Téléchargements, touchez « ${VCF_NAME} » puis « Ajouter les ${contacts} contacts ».`,
        )
      }
      return
    }
    const outcome = await saveFile(VCF_NAME, new Blob([vcf], { type: 'text/x-vcard;charset=utf-8' }))
    if (outcome === 'saved') {
      setNotice(
        android
          ? `Ouvrez le fichier téléchargé : l'application Contacts importe les ${contacts} contacts d'un coup.`
          : `Fichier enregistré : importez-le dans Contacts (Mac), Google Contacts ou Outlook pour ajouter les ${contacts} contacts.`,
      )
    }
  }

  async function addOne(e: ReaderEntry) {
    const slugName = `${e.first_name}-${e.last_name}`
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9-]+/g, '-')
      .toLowerCase()
    await saveFile(`${slugName}.vcf`, new Blob([buildOneVcf(e, ctx)], { type: 'text/vcard;charset=utf-8' }))
  }

  async function downloadPdf() {
    await saveFile('annuaire-afterwork-interasso.pdf', directoryPdf(data.title, data.event_date, data.entries))
  }

  return (
    <section className="dir">
      <div className="dir-head">
        <h2>Votre annuaire, {name}</h2>
        <p>
          {data.entries.length} participants · {contacts} avec leurs coordonnées
        </p>
      </div>

      <div className="dir-actions">
        <button className="btn btn-primary dir-primary" onClick={addContacts} disabled={contacts === 0}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M19 8v6M22 11h-6" />
          </svg>
          Ajouter les {contacts} contacts à mon {ios ? 'iPhone' : 'téléphone'}
        </button>
        {ios ? (
          <ol className="dir-steps">
            <li>Touchez le bouton ci-dessus.</li>
            <li>
              Dans le menu, choisissez <b>Contacts</b>. S'il n'apparaît pas : <b>Enregistrer dans
              Fichiers</b>, puis ouvrez le fichier depuis l'app Fichiers.
            </li>
            <li>
              Touchez <b>Ajouter les {contacts} contacts</b>.
            </li>
          </ol>
        ) : (
          <p className="dir-hint">
            {android
              ? "Ouvrez le fichier téléchargé : l'application Contacts importe toutes les fiches d'un coup."
              : 'Sur téléphone, ouvrez cette page depuis le lien reçu par mail pour tout ajouter en un geste.'}
          </p>
        )}
        {notice && <div className="banner ok">{notice}</div>}
        <button className="btn dir-secondary" onClick={downloadPdf}>
          Télécharger l'annuaire en PDF
        </button>
      </div>

      <label className="dir-search">
        <span className="visually-hidden">Rechercher</span>
        <input
          type="search"
          placeholder="Rechercher un nom, une activité, une association…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      <ul className="dir-list">
        {list.map((e, i) => {
          const phone = formatPhone(e.phone)
          const shared = e.share_contact && !!(e.email || phone)
          return (
            <li
              key={e.id}
              className={`dir-card${e.id === data.me ? ' is-me' : ''}`}
              style={{ '--k': Math.min(i, 12) } as CSSProperties}
            >
              <span className="dir-avatar" style={{ background: groupColor(e.grp) }}>
                {initials(e)}
              </span>
              <div className="dir-body">
                <div className="dir-name">
                  {e.first_name} <span className="dir-last">{e.last_name}</span>
                  {e.id === data.me && <span className="dir-you">vous</span>}
                </div>
                {e.activity && <div className="dir-activity">{e.activity}</div>}
                {e.grp && <span className="dir-grp">{e.grp}</span>}
                {shared ? (
                  <div className="dir-contact">
                    {e.email && <a href={`mailto:${e.email}`}>{e.email}</a>}
                    {phone && <a href={`tel:${phone.dial}`}>{phone.display}</a>}
                  </div>
                ) : (
                  <div className="dir-private">Coordonnées non partagées</div>
                )}
              </div>
              {shared && e.id !== data.me && (
                <button
                  className="dir-add"
                  onClick={() => addOne(e)}
                  aria-label={`Ajouter ${e.first_name} ${e.last_name} à mes contacts`}
                  title="Ajouter à mes contacts"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M19 8v6M22 11h-6" />
                  </svg>
                </button>
              )}
            </li>
          )
        })}
        {list.length === 0 && <li className="dir-empty">Aucun participant ne correspond.</li>}
      </ul>

      <p className="dir-reminder">
        <b>Rappel de votre engagement.</b> {ENGAGEMENT_TEXT}
      </p>

      <Credit onOpen={() => api.trackClick(slug, 'directory')} />
    </section>
  )
}

// ---------------------------------------------------------------------------
// La page

export function DirectoryPage({ slug, code }: { slug: string; code: string }) {
  const playing = useSequence({ duration: INTRO_MS, once: 'annuaire-lecteur-intro' })
  const [eventInfo, setEventInfo] = useState<{ title: string; date: string } | null>(null)
  const [stage, setStage] = useState<Stage>('login')
  const [email, setEmail] = useState(() => {
    try {
      return sessionStorage.getItem(EMAIL_KEY) ?? ''
    } catch {
      return ''
    }
  })
  const [who, setWho] = useState<string>('')
  const [engaged, setEngaged] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ text: string; at: number } | null>(null)
  const [data, setData] = useState<ReaderDirectory | null>(null)
  const checkbox = useRef<HTMLInputElement>(null)

  useEffect(() => {
    prefetchEvent(slug).then(
      (ev) => setEventInfo({ title: ev.title, date: ev.event_date }),
      () => setEventInfo(null),
    )
  }, [slug])

  useEffect(() => {
    if (stage === 'engage') checkbox.current?.focus()
  }, [stage])

  useEffect(() => {
    if (stage !== 'engage') return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setStage('login')
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [stage])

  const title = eventInfo?.title ?? 'Afterwork INTERASSO'
  const dateIso = eventInfo?.date ?? '2026-10-06'
  const kicker = eventKicker(title, dateIso)
  const [y, m, d] = dateIso.split('-').map(Number)
  const shortDate = new Date(y, m - 1, d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

  async function login(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await api.readerCheck(slug, code, email)
      try {
        sessionStorage.setItem(EMAIL_KEY, email.trim())
      } catch {
        // Sans stockage, il faudra ressaisir l'adresse au prochain passage.
      }
      setWho(formatFirstName(res.first_name))
      setEngaged(false)
      setStage('engage')
    } catch (err) {
      setError({ text: errorText(err), at: Date.now() })
    } finally {
      setBusy(false)
    }
  }

  function ready() {
    setStage('ready')
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }

  async function open() {
    setBusy(true)
    setError(null)
    try {
      const res = await api.readerOpen(slug, code, email, ENGAGEMENT_VERSION)
      setData({ ...res, entries: res.entries.map(formatEntry).sort(byName) })
      setStage('flight')
    } catch (err) {
      setStage('login')
      setError({ text: errorText(err), at: Date.now() })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Embers />
      <div
        className={`public vitrine reader${playing && stage === 'login' ? ' intro' : ''}${
          stage === 'flight' || stage === 'ready' ? ' is-compact' : ''
        }`}
      >
        <div className="public-glow" aria-hidden="true" />
        <header className="public-head">
          <img className="public-logo" src={LOGO_14_AVENUE_LIGHT} alt="Le 14 Avenue" />
          <p className="public-kicker">{kicker}</p>
          <h1 className="hero" aria-label="Annuaire des participants">
            <SplitText className="hero-line1" text="Annuaire" />
            <span className="hero-line2">des participants</span>
          </h1>
        </header>

        <main className="reader-body">
          {(stage === 'login' || stage === 'engage') && (
            <>
              <Book intro={playing} title={title} date={shortDate} />
              <form className="reader-login" onSubmit={login}>
                <p className="public-text">
                  Entrez l'adresse mail donnée lors de votre inscription pour ouvrir l'annuaire.
                </p>
                {error && (
                  <div key={error.at} className="banner bad" role="alert">
                    {error.text}
                  </div>
                )}
                <label className="form-field">
                  <span>Votre adresse mail</span>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
                <button className="btn btn-primary form-submit" disabled={busy}>
                  {busy ? 'Vérification…' : "Ouvrir l'annuaire"}
                </button>
              </form>
            </>
          )}

          {stage === 'flight' && data && (
            <Flight data={data} title={title} date={shortDate} onDone={ready} />
          )}

          {stage === 'ready' && data && <Directory data={data} name={who} slug={slug} />}
        </main>

        {stage === 'engage' && (
          <div className="engage-backdrop" onClick={() => setStage('login')}>
            <div
              className="engage"
              role="dialog"
              aria-modal="true"
              aria-labelledby="engage-title"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="engage-hello">Bonjour {who} !</p>
              <h2 id="engage-title">Avant d'ouvrir l'annuaire</h2>
              <p className="engage-text">
                Les participants vous confient leurs coordonnées pour garder le contact après la
                soirée. Merci de respecter cette confiance.
              </p>
              <label className={`consent${engaged ? ' is-checked' : ''}`}>
                <input
                  ref={checkbox}
                  type="checkbox"
                  className="consent-input"
                  checked={engaged}
                  onChange={(e) => setEngaged(e.target.checked)}
                />
                <span className="consent-box" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                </span>
                <span className="consent-text">{ENGAGEMENT_TEXT}</span>
              </label>
              <div className="engage-actions">
                <button className="btn btn-primary form-submit" disabled={!engaged || busy} onClick={open}>
                  {busy ? 'Ouverture…' : "Je m'engage et j'ouvre l'annuaire"}
                </button>
                <button className="btn btn-ghost" onClick={() => setStage('login')}>
                  Annuler
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
