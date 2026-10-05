import { useEffect, useMemo, useState } from 'react'
import qrcode from 'qrcode-generator'
import { api, ApiError, frDate, type AdminEvent, type PublicEvent } from './api'
import { CURRENT_EVENT, SITE_URL, formUrl } from './config'
import { directoryPdf } from '../listing'
import { buildXlsx } from '../xlsx'
import { saveFile } from '../download'

interface Props {
  onClose: () => void
}

// En développement seulement, ?evenement=<slug> pointe le panneau vers une
// soirée de test, pour ne jamais manipuler la vraie pendant les essais.
const EVENT =
  (import.meta.env.DEV && new URLSearchParams(window.location.search).get('evenement')) ||
  CURRENT_EVENT

const KEY_STORAGE = `afterwork-annuaire-cle/${EVENT}`

function readKey(): string {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? ''
  } catch {
    return ''
  }
}

function storeKey(key: string | null) {
  try {
    if (key) localStorage.setItem(KEY_STORAGE, key)
    else localStorage.removeItem(KEY_STORAGE)
  } catch {
    // Stockage indisponible : il faudra ressaisir la clé à chaque ouverture.
  }
}

function message(err: unknown) {
  if (err instanceof ApiError && err.code === 'reseau') {
    return `L'annuaire n'est accessible que depuis le site en ligne : ${SITE_URL.replace('https://', '')}.`
  }
  return err instanceof ApiError ? err.message : 'Une erreur est survenue.'
}

/** Panneau organisateur : ouverture du formulaire, réponses, annuaire. */
export default function AdminPanel({ onClose }: Props) {
  const slug = EVENT
  const [publicEvent, setPublicEvent] = useState<PublicEvent | null>(null)
  const [key, setKey] = useState(readKey)
  const [keyInput, setKeyInput] = useState('')
  const [keyConfirm, setKeyConfirm] = useState('')
  const [data, setData] = useState<AdminEvent | null>(null)
  const [contact, setContact] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmPurge, setConfirmPurge] = useState(false)

  async function load(withKey: string) {
    const event = await api.admin(slug, withKey)
    setData(event)
    setContact(event.contact_email ?? '')
    setKey(withKey)
    storeKey(withKey)
  }

  useEffect(() => {
    api.event(slug).then(setPublicEvent, (err) => setError(message(err)))
    const stored = readKey()
    if (stored) load(stored).catch(() => storeKey(null))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function run(action: () => Promise<void>, success?: string) {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await action()
      if (success) setNotice(success)
    } catch (err) {
      setError(message(err))
    } finally {
      setBusy(false)
    }
  }

  const url = formUrl(slug)
  const qrSvg = useMemo(() => {
    const qr = qrcode(0, 'M')
    qr.addData(url)
    qr.make()
    return qr.createSvgTag({ cellSize: 8, margin: 2, scalable: true })
  }, [url])

  const entries = data?.entries ?? []
  const sharing = entries.filter((e) => e.share_contact).length

  // ---- Connexion ----------------------------------------------------------

  const login = (
    <div className="annuaire-section">
      {publicEvent && !publicEvent.claimed ? (
        <>
          <h3 className="pane-title">Créer la clé organisateur</h3>
          <p className="card-hint">
            Elle protège l'accès aux réponses. Choisissez-la longue (12 caractères au moins) et
            gardez-la précieusement : elle n'est stockée que sous forme chiffrée et ne peut pas être
            récupérée.
          </p>
          <form
            className="key-form"
            onSubmit={(e) => {
              e.preventDefault()
              if (keyInput !== keyConfirm) {
                setError('Les deux saisies de la clé ne correspondent pas.')
                return
              }
              run(async () => {
                await api.claim(slug, keyInput)
                await load(keyInput)
              })
            }}
          >
            <input
              type="password"
              autoComplete="new-password"
              placeholder="Clé organisateur"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              minLength={12}
              required
            />
            <input
              type="password"
              autoComplete="new-password"
              placeholder="Confirmez la clé"
              value={keyConfirm}
              onChange={(e) => setKeyConfirm(e.target.value)}
              minLength={12}
              required
            />
            <button className="btn btn-primary" disabled={busy}>
              Créer la clé
            </button>
          </form>
        </>
      ) : (
        <>
          <h3 className="pane-title">Connexion organisateur</h3>
          <form
            className="key-form"
            onSubmit={(e) => {
              e.preventDefault()
              run(() => load(keyInput))
            }}
          >
            <input
              type="password"
              autoComplete="current-password"
              placeholder="Clé organisateur"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              required
            />
            <button className="btn btn-primary" disabled={busy}>
              Se connecter
            </button>
          </form>
        </>
      )}
    </div>
  )

  // ---- Tableau de bord ----------------------------------------------------

  const status = !data
    ? null
    : data.is_open && data.contact_email
      ? { label: 'Formulaire ouvert', tone: 'good' }
      : !data.contact_email
        ? { label: 'Adresse de contact requise', tone: 'warn' }
        : { label: 'Formulaire fermé', tone: '' }

  const dashboard = data && (
    <>
      <div className="annuaire-section">
        <div className="annuaire-row">
          <h3 className="pane-title">Ouverture du formulaire</h3>
          {status && <span className={`pill ${status.tone}`}>{status.label}</span>}
        </div>
        <p className="card-hint">
          Les participants doivent pouvoir exercer leurs droits : l'adresse de contact figure dans
          les mentions du formulaire, qui ne peut pas ouvrir sans elle.
        </p>
        <div className="key-form">
          <input
            type="email"
            placeholder="Adresse de contact du collectif"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
          />
          <button
            className="btn"
            disabled={busy}
            onClick={() =>
              run(async () => {
                await api.adminUpdate(slug, key, contact, data.is_open)
                await load(key)
              }, 'Adresse enregistrée.')
            }
          >
            Enregistrer
          </button>
          <button
            className={`btn ${data.is_open ? '' : 'btn-primary'}`}
            disabled={busy || (!data.is_open && !data.contact_email)}
            onClick={() =>
              run(async () => {
                await api.adminUpdate(slug, key, data.contact_email ?? '', !data.is_open)
                await load(key)
              }, data.is_open ? 'Formulaire fermé.' : 'Formulaire ouvert.')
            }
          >
            {data.is_open ? 'Fermer le formulaire' : 'Ouvrir le formulaire'}
          </button>
        </div>
      </div>

      <div className="annuaire-section annuaire-link">
        <div className="qr" dangerouslySetInnerHTML={{ __html: qrSvg }} />
        <div className="annuaire-link-body">
          <h3 className="pane-title">Lien du formulaire</h3>
          <p className="card-hint">
            À projeter, afficher sur les tables ou envoyer après la soirée.
          </p>
          <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
          <div className="annuaire-actions">
            <button className="btn btn-sm" onClick={() => navigator.clipboard?.writeText(url)}>
              Copier le lien
            </button>
            <button
              className="btn btn-sm"
              onClick={() => saveFile('qr-annuaire-interasso.svg', new Blob([qrSvg]))}
            >
              Télécharger le QR code
            </button>
            <a className="btn btn-sm btn-ghost" href={url} target="_blank" rel="noreferrer">
              Voir le formulaire
            </a>
          </div>
        </div>
      </div>

      <div className="annuaire-section">
        <div className="annuaire-row">
          <h3 className="pane-title">
            Réponses <span className="count">{entries.length}</span>
          </h3>
          <span className="card-hint">
            {sharing} partage{sharing > 1 ? 'nt' : ''} ses coordonnées · conservation jusqu'au{' '}
            {frDate(data.retention_until)}
          </span>
        </div>

        <div className="annuaire-actions">
          <button
            className="btn btn-primary btn-sm"
            disabled={entries.length === 0}
            onClick={() =>
              run(async () => {
                await saveFile(
                  'annuaire-participants.pdf',
                  directoryPdf(data.title, data.event_date, entries),
                )
              })
            }
          >
            Annuaire PDF
          </button>
          <button
            className="btn btn-sm"
            disabled={entries.length === 0}
            onClick={() =>
              run(async () => {
                await navigator.clipboard.writeText(entries.map((e) => e.email).join('; '))
              }, `${entries.length} adresses copiées — à coller en copie cachée (Cci).`)
            }
          >
            Copier les emails (Cci)
          </button>
          <button
            className="btn btn-sm"
            disabled={entries.length === 0}
            onClick={() =>
              run(async () => {
                const rows = [
                  ['Prénom', 'Nom', 'Activité', 'Groupe', 'Email', 'Téléphone', 'Coordonnées partagées', 'Consentement'],
                  ...entries.map((e) => [
                    e.first_name,
                    e.last_name,
                    e.activity,
                    e.grp,
                    e.email,
                    e.phone,
                    e.share_contact ? 'oui' : 'non',
                    frDate(e.consented_at),
                  ]),
                ]
                await saveFile('reponses-annuaire.xlsx', buildXlsx(rows))
              })
            }
          >
            Export Excel
          </button>
          <button className="btn btn-sm btn-ghost" disabled={busy} onClick={() => run(() => load(key))}>
            Actualiser
          </button>
        </div>

        {entries.length === 0 ? (
          <p className="empty">Aucune réponse pour l'instant.</p>
        ) : (
          <div className="person-table-wrap">
            <table className="annuaire-table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Activité</th>
                  <th>Groupe</th>
                  <th>Contact</th>
                  <th title="Coordonnées partagées dans l'annuaire">Partage</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td>
                      {e.first_name} {e.last_name}
                    </td>
                    <td>{e.activity}</td>
                    <td>{e.grp || '—'}</td>
                    <td className="contact-cell">
                      {e.email}
                      {e.phone && <span>{e.phone}</span>}
                    </td>
                    <td>{e.share_contact ? 'oui' : 'non'}</td>
                    <td>
                      <button
                        className="btn btn-icon"
                        title="Supprimer cette réponse"
                        aria-label={`Supprimer ${e.first_name} ${e.last_name}`}
                        onClick={() => run(async () => {
                          await api.adminDelete(slug, key, e.id)
                          await load(key)
                        })}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="annuaire-section annuaire-footer">
        {confirmPurge ? (
          <>
            <span className="card-hint">Toutes les réponses seront définitivement effacées.</span>
            <button
              className="btn btn-sm btn-danger"
              onClick={() =>
                run(async () => {
                  await api.adminPurge(slug, key)
                  setConfirmPurge(false)
                  await load(key)
                }, 'Toutes les réponses ont été effacées.')
              }
            >
              Confirmer l'effacement
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => setConfirmPurge(false)}>
              Annuler
            </button>
          </>
        ) : (
          <button className="btn btn-sm btn-ghost" onClick={() => setConfirmPurge(true)}>
            Effacer toutes les réponses
          </button>
        )}
        <span className="spacer" />
        <button
          className="btn btn-sm btn-ghost"
          onClick={() => {
            storeKey(null)
            setKey('')
            setData(null)
            setKeyInput('')
          }}
        >
          Se déconnecter
        </button>
      </div>
    </>
  )

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-card annuaire-card" onClick={(e) => e.stopPropagation()}>
        <div className="card-head">
          <h2 className="card-title">Annuaire des participants</h2>
          <button className="btn btn-icon" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </div>
        {notice && <div className="banner ok">{notice}</div>}
        {error && <div className="banner bad">{error}</div>}
        {data ? dashboard : login}
      </div>
    </div>
  )
}
