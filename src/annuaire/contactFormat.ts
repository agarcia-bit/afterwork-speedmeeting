// Mise en forme uniforme des fiches de l'annuaire : chacun a rempli le
// formulaire à sa façon (MAJUSCULES, minuscules, 0612…, +33 6…), l'annuaire
// remis aux participants présente tout le monde de la même manière.

/** « jean-pierre » → « Jean-Pierre », « ANNE » → « Anne ». */
export function formatFirstName(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('fr-FR')
    .replace(/(^|[\s\-'’])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toLocaleUpperCase('fr-FR'))
}

/** Nom de famille en capitales, accents conservés : « Démo » → « DÉMO ». */
export function formatLastName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toLocaleUpperCase('fr-FR')
}

/** Activité nettoyée : espaces superflus retirés, majuscule initiale, sans point final. */
export function formatActivity(raw: string): string {
  const text = raw.trim().replace(/\s+/g, ' ').replace(/[.\s]+$/, '')
  return text ? text[0].toLocaleUpperCase('fr-FR') + text.slice(1) : ''
}

export interface Phone {
  /** Pour l'affichage : « 06 12 34 56 78 ». */
  display: string
  /** Format international, pour le téléphone : « +33 6 12 34 56 78 ». */
  intl: string
  /** Pour les liens tel: — « +33612345678 ». */
  dial: string
}

const pairs = (digits: string) => digits.match(/\d{1,2}/g)?.join(' ') ?? digits

/**
 * Numéro uniformisé. Les numéros français (0612…, 612…, +33 6…, 0033 6…,
 * 33 6…) prennent tous la même forme ; un numéro étranger est seulement
 * nettoyé. Renvoie null si le champ est vide.
 */
export function formatPhone(raw: string): Phone | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  let digits = trimmed.replace(/[^\d+]/g, '').replace(/^00/, '+')
  const plus = digits.startsWith('+')
  digits = digits.replace(/\+/g, '')

  let national: string | null = null // 9 chiffres après le 0
  if (plus && digits.startsWith('33')) national = digits.slice(2).replace(/^0/, '')
  else if (!plus && digits.length === 10 && digits.startsWith('0')) national = digits.slice(1)
  else if (!plus && digits.length === 9 && !digits.startsWith('0')) national = digits
  else if (!plus && digits.length === 11 && digits.startsWith('33')) national = digits.slice(2)

  if (national && national.length === 9) {
    return {
      display: `0${national[0]} ${pairs(national.slice(1))}`,
      intl: `+33 ${national[0]} ${pairs(national.slice(1))}`,
      dial: `+33${national}`,
    }
  }
  if (plus && digits.length >= 8) {
    return { display: `+${digits}`, intl: `+${digits}`, dial: `+${digits}` }
  }
  // Numéro mal saisi (un chiffre de trop…) : présenté comme les autres, sans deviner.
  return digits ? { display: pairs(digits), intl: pairs(digits), dial: digits } : null
}

interface ContactFields {
  first_name: string
  last_name: string
  activity: string
  grp: string
  email: string
  phone: string
}

/** Fiche prête à afficher : noms, activité, adresse et numéro uniformisés. */
export function formatEntry<T extends ContactFields>(e: T): T {
  return {
    ...e,
    first_name: formatFirstName(e.first_name),
    last_name: formatLastName(e.last_name),
    activity: formatActivity(e.activity),
    grp: e.grp.trim().replace(/\s+/g, ' '),
    email: e.email.trim().toLowerCase(),
    phone: formatPhone(e.phone)?.display ?? '',
  }
}

/** Tri de l'annuaire : nom puis prénom, sans tenir compte des accents. */
export function byName(a: ContactFields, b: ContactFields): number {
  return (
    a.last_name.localeCompare(b.last_name, 'fr', { sensitivity: 'base' }) ||
    a.first_name.localeCompare(b.first_name, 'fr', { sensitivity: 'base' })
  )
}
