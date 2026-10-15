// Base de l'annuaire : projet Supabase « communitia », schéma privé « annuaire ».
// La clé publiable est faite pour figurer dans le code du navigateur : elle ne
// donne accès qu'aux fonctions public.annuaire_*, qui contrôlent elles-mêmes
// ce qu'elles autorisent.
export const SUPABASE_URL = 'https://babwgeinxbauwztnypuh.supabase.co'
export const SUPABASE_KEY = 'sb_publishable_8jdeeFA6rhoR4P7GsaIltA__51t0Ajx'

/** Soirée en cours. Une nouvelle édition = une nouvelle ligne dans annuaire.events. */
export const CURRENT_EVENT = 'interasso-2026-65a020'

/** Adresse publique du site, pour les liens et le QR code. */
export const SITE_URL = 'https://afterwork-speedmeeting.netlify.app'

/**
 * Version des mentions acceptées, enregistrée avec chaque consentement pour
 * savoir quel texte la personne a lu. À changer à chaque modification de
 * legal.tsx.
 */
export const CONSENT_VERSION = '2026-10-05-v1'

export const formUrl = (slug: string) => `${SITE_URL}/annuaire/${slug}`
export const selfUrl = (token: string) => `${SITE_URL}/annuaire/moi/${token}`

/** Page de diffusion de l'annuaire, envoyée par l'organisateur (campagne Brevo). */
export const readerUrl = (slug: string, code: string) => `${SITE_URL}/annuaire/${slug}/recevoir/${code}`

/**
 * Engagement accepté avant d'ouvrir l'annuaire. Sa version est enregistrée
 * avec chaque accès : en changer le texte impose de changer la version.
 */
export const ENGAGEMENT_VERSION = 'engagement-2026-10-15-v1'
export const ENGAGEMENT_TEXT =
  "Je m'engage à utiliser ces contacts uniquement pour mon usage personnel, pour reprendre contact avec les participants de la soirée, et à ne pas les transmettre, les publier ni les partager avec d'autres personnes."
