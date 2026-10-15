import type { ReaderEntry } from './api'

/** Échappement des valeurs vCard 3.0 (RFC 2426). */
function esc(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\;')
}

/**
 * Fichier de contacts à ouvrir sur le téléphone : un appui l'importe dans
 * l'application Contacts. Seules les personnes qui ont accepté de partager
 * leurs coordonnées y figurent, et jamais soi-même.
 */
export function buildVcf(entries: ReaderEntry[], meId: string, note: string): string {
  const cards = entries
    .filter((e) => e.id !== meId && e.share_contact && (e.email || e.phone))
    .map((e) => {
      const lines = [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `N:${esc(e.last_name)};${esc(e.first_name)};;;`,
        `FN:${esc(`${e.first_name} ${e.last_name}`)}`,
      ]
      if (e.grp) lines.push(`ORG:${esc(e.grp)}`)
      if (e.activity) lines.push(`TITLE:${esc(e.activity)}`)
      if (e.email) lines.push(`EMAIL;TYPE=INTERNET:${esc(e.email)}`)
      if (e.phone) lines.push(`TEL;TYPE=CELL:${esc(e.phone)}`)
      lines.push(`NOTE:${esc(note)}`, 'END:VCARD')
      return lines.join('\r\n')
    })
  return cards.join('\r\n') + '\r\n'
}

export function shareableCount(entries: ReaderEntry[], meId: string): number {
  return entries.filter((e) => e.id !== meId && e.share_contact && (e.email || e.phone)).length
}
