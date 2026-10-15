import type { ReaderEntry } from './api'
import { formatPhone } from './contactFormat'

/** Échappement des valeurs vCard 3.0 (RFC 2426). */
function esc(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
}

/** Lignes repliées à 75 octets (RFC 2425) : certains carnets d'adresses
 * s'arrêtent sinon à la première ligne trop longue. */
function fold(line: string): string {
  const encoder = new TextEncoder()
  const out: string[] = []
  let current = ''
  let size = 0
  for (const ch of Array.from(line)) {
    const n = encoder.encode(ch).length
    const limit = out.length === 0 ? 75 : 74 // la suite commence par une espace
    if (size + n > limit) {
      out.push(current)
      current = ''
      size = 0
    }
    current += ch
    size += n
  }
  out.push(current)
  return out.join('\r\n ')
}

export interface VcfContext {
  /** « Afterwork INTERASSO » */
  title: string
  /** « 6 octobre 2026 » */
  date: string
}

const shareable = (e: ReaderEntry) => e.share_contact && !!(e.email || e.phone)

/**
 * Fiche de contact enrichie : sous le nom, le téléphone affiche l'association
 * et l'activité ; la note rappelle où et quand on s'est rencontrés.
 */
function card(e: ReaderEntry, ctx: VcfContext): string {
  const phone = formatPhone(e.phone)
  const note = [
    `Rencontré·e à l'${ctx.title}, le ${ctx.date}.`,
    e.activity_detail?.trim() || (e.activity && `Activité : ${e.activity}`),
    e.grp && `Association : ${e.grp}`,
  ]
    .filter(Boolean)
    .join('\n')
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${esc(e.last_name)};${esc(e.first_name)};;;`,
    `FN:${esc(`${e.first_name} ${e.last_name}`)}`,
  ]
  if (e.grp) lines.push(`ORG:${esc(e.grp)}`)
  if (e.activity) lines.push(`TITLE:${esc(e.activity)}`)
  if (e.email) lines.push(`EMAIL;TYPE=INTERNET:${esc(e.email)}`)
  if (phone) lines.push(`TEL;TYPE=CELL:${esc(phone.intl)}`)
  lines.push(`NOTE:${esc(note)}`, `CATEGORIES:${esc(ctx.title)}`, 'END:VCARD')
  return lines.map(fold).join('\r\n')
}

/**
 * Fichier de contacts à ouvrir sur le téléphone. Seules les personnes qui ont
 * accepté de partager leurs coordonnées y figurent, et jamais soi-même.
 */
export function buildVcf(entries: ReaderEntry[], meId: string, ctx: VcfContext): string {
  return (
    entries
      .filter((e) => e.id !== meId && shareable(e))
      .map((e) => card(e, ctx))
      .join('\r\n') + '\r\n'
  )
}

/** Une seule fiche, pour l'ajouter depuis sa carte dans l'annuaire. */
export function buildOneVcf(entry: ReaderEntry, ctx: VcfContext): string {
  return card(entry, ctx) + '\r\n'
}

export function shareableCount(entries: ReaderEntry[], meId: string): number {
  return entries.filter((e) => e.id !== meId && shareable(e)).length
}
