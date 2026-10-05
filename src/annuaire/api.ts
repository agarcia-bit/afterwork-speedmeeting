import { SUPABASE_KEY, SUPABASE_URL } from './config'

export interface PublicEvent {
  title: string
  event_date: string
  controller: string
  contact_email: string | null
  is_open: boolean
  retention_until: string
  claimed: boolean
}

export interface EntryFields {
  first_name: string
  last_name: string
  activity: string
  grp: string
  email: string
  phone: string
  share_contact: boolean
}

export interface MyEntry extends EntryFields {
  consented_at: string
  event: Omit<PublicEvent, 'is_open' | 'claimed'>
}

export interface AdminEntry extends EntryFields {
  id: string
  consented_at: string
}

export interface AdminEvent extends Omit<PublicEvent, 'claimed'> {
  entries: AdminEntry[]
}

/** Erreur métier renvoyée par la base, traduite pour l'utilisateur. */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

const MESSAGES: Record<string, string> = {
  evenement_introuvable: "Ce lien ne correspond à aucune soirée. Vérifiez l'adresse.",
  formulaire_ferme: "Le formulaire n'est pas ouvert pour le moment.",
  consentement_requis: "Cochez la première case pour figurer dans l'annuaire.",
  deja_inscrit:
    'Cette adresse mail est déjà inscrite. Utilisez votre lien personnel pour modifier vos informations.',
  complet: "L'annuaire a atteint sa capacité maximale.",
  inscription_introuvable: "Ce lien personnel n'est plus valable : l'inscription a peut-être été supprimée.",
  acces_refuse: 'Clé organisateur incorrecte.',
  deja_revendique: 'Une clé organisateur existe déjà pour cette soirée : connectez-vous avec elle.',
  cle_trop_courte: 'La clé doit faire au moins 12 caractères.',
  entries_email: "L'adresse mail ne semble pas valide.",
  entries_names: 'Le prénom et le nom sont obligatoires (80 caractères au plus).',
  entries_activity: "L'activité est obligatoire (160 caractères au plus).",
  entries_phone: 'Le numéro de téléphone est trop long.',
  events_contact: "L'adresse de contact ne semble pas valide.",
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    })
  } catch {
    throw new ApiError(
      'reseau',
      'Connexion impossible. Vérifiez votre accès à Internet, puis réessayez.',
    )
  }
  if (response.ok) {
    const text = await response.text()
    return (text ? JSON.parse(text) : null) as T
  }
  const body = (await response.json().catch(() => ({}))) as { message?: string }
  const raw = body.message ?? ''
  // Les contraintes de la base remontent sous la forme « … constraint "nom" ».
  const code = raw.match(/constraint "([^"]+)"/)?.[1] ?? raw
  throw new ApiError(code, MESSAGES[code] ?? "Une erreur est survenue. Réessayez dans un instant.")
}

export const api = {
  event: (slug: string) => rpc<PublicEvent>('annuaire_event', { p_slug: slug }),

  submit: (slug: string, f: EntryFields, version: string) =>
    rpc<{ token: string }>('annuaire_submit', {
      p_slug: slug,
      p_first_name: f.first_name,
      p_last_name: f.last_name,
      p_activity: f.activity,
      p_grp: f.grp,
      p_email: f.email,
      p_phone: f.phone,
      p_share_profile: true,
      p_share_contact: f.share_contact,
      p_consent_version: version,
    }),

  me: (token: string) => rpc<MyEntry>('annuaire_me', { p_token: token }),

  updateMe: (token: string, f: EntryFields, version: string) =>
    rpc<null>('annuaire_update_me', {
      p_token: token,
      p_first_name: f.first_name,
      p_last_name: f.last_name,
      p_activity: f.activity,
      p_grp: f.grp,
      p_email: f.email,
      p_phone: f.phone,
      p_share_contact: f.share_contact,
      p_consent_version: version,
    }),

  deleteMe: (token: string) => rpc<null>('annuaire_delete_me', { p_token: token }),

  claim: (slug: string, key: string) => rpc<null>('annuaire_claim', { p_slug: slug, p_key: key }),

  admin: (slug: string, key: string) => rpc<AdminEvent>('annuaire_admin', { p_slug: slug, p_key: key }),

  adminUpdate: (slug: string, key: string, contactEmail: string, isOpen: boolean) =>
    rpc<null>('annuaire_admin_update', {
      p_slug: slug,
      p_key: key,
      p_contact_email: contactEmail,
      p_is_open: isOpen,
    }),

  adminDelete: (slug: string, key: string, entryId: string) =>
    rpc<null>('annuaire_admin_delete_entry', { p_slug: slug, p_key: key, p_entry: entryId }),

  adminPurge: (slug: string, key: string) =>
    rpc<null>('annuaire_admin_purge', { p_slug: slug, p_key: key }),
}

export function frDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
