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
