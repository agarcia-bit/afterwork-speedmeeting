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
  /** Inscription en double : fiche principale qu'elle rejoint dans l'annuaire. */
  duplicate_of: string | null
}

/** Clics sur la carte « Par Agalumy », sans rien qui identifie la personne. */
export interface ClickStats {
  total: number
  form: number
  thanks: number
  last: string | null
  by_day: { day: string; n: number }[]
}

export interface DistributionStats {
  open: boolean
  code: string | null
  /** Personnes ayant ouvert l'annuaire au moins une fois. */
  readers: number
  last: string | null
}

export interface AdminEvent extends Omit<PublicEvent, 'claimed'> {
  entries: (AdminEntry & { opened_at: string | null })[]
  clicks: ClickStats
  distribution: DistributionStats
}

/** Fiche telle que la voit un participant : coordonnées seulement si partagées. */
export interface ReaderEntry {
  id: string
  /** Présentation détaillée de l'activité, rédigée par l'organisateur (peut être vide). */
  activity_detail: string
  first_name: string
  last_name: string
  activity: string
  grp: string
  email: string
  phone: string
  share_contact: boolean
}

export interface ReaderDirectory {
  title: string
  event_date: string
  me: string
  entries: ReaderEntry[]
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
  acces_ferme:
    "Ce lien n'est pas valable, ou l'annuaire n'est pas encore ouvert. Utilisez le lien reçu par mail.",
  adresse_inconnue:
    "Cette adresse ne figure pas parmi les personnes qui ont rempli le formulaire. Utilisez celle donnée lors de votre inscription.",
  engagement_requis: "Cochez l'engagement pour ouvrir l'annuaire.",
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

  readerCheck: (slug: string, code: string, email: string) =>
    rpc<{ first_name: string; title: string; event_date: string; count: number }>(
      'annuaire_reader_check',
      { p_slug: slug, p_code: code, p_email: email },
    ),

  readerOpen: (slug: string, code: string, email: string, engagement: string) =>
    rpc<ReaderDirectory>('annuaire_reader_open', {
      p_slug: slug,
      p_code: code,
      p_email: email,
      p_engagement: engagement,
    }),

  /** Donnant-donnant : le lecteur partage ses coordonnées pour voir celles des autres. */
  readerShare: (slug: string, code: string, email: string, version: string) =>
    rpc<null>('annuaire_reader_share', { p_slug: slug, p_code: code, p_email: email, p_version: version }),

  adminDistribution: (slug: string, key: string, open: boolean) =>
    rpc<string>('annuaire_admin_distribution', { p_slug: slug, p_key: key, p_open: open }),

  /**
   * Compte un clic vers le site d'Agalumy. Ne doit jamais gêner la visite :
   * envoi en arrière-plan, maintenu si l'onglet change, erreurs ignorées.
   */
  trackClick(slug: string, page: 'form' | 'thanks' | 'directory') {
    fetch(`${SUPABASE_URL}/rest/v1/rpc/annuaire_track_click`, {
      method: 'POST',
      keepalive: true,
      headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_slug: slug, p_page: page }),
    }).catch(() => {})
  },

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
