// Fiches individuelles : une page A5 par participant, à envoyer par mail.
// Fond clair et accents orange — pensées pour l'écran d'un téléphone
// et pour une impression sans vider une cartouche.
import { jsPDF } from 'jspdf'
import type { EventState, Participant } from './types'

const ORANGE = '#d97219'
const INK = '#1c1712'
const GREY = '#7d7166'
const RULE = '#ddd2c4'

export interface SheetRow {
  rotation: number
  /** Numéro de table, ou null si la personne ne participe pas à ce tour. */
  table: number | null
  mates: string[]
}

export function sheetRows(state: EventState, id: string): SheetRow[] {
  const byId = new Map(state.participants.map((p) => [p.id, p]))
  return state.rotations.map((rot, r) => {
    const t = rot.findIndex((table) => table.includes(id))
    return {
      rotation: r + 1,
      table: t === -1 ? null : t + 1,
      mates:
        t === -1
          ? []
          : rot[t]
              .filter((x) => x !== id)
              .map((x) => byId.get(x)?.name ?? '')
              .filter(Boolean)
              .sort((a, b) => a.localeCompare(b, 'fr')),
    }
  })
}

/** Nom de fichier sûr et lisible : « fiche-marie-delcourt.pdf ». */
export function sheetFilename(p: Participant): string {
  const slug = p.name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
  return `fiche-${slug || 'participant'}.pdf`
}

const W = 148 // A5 portrait, en millimètres
const H = 210
const M = 14

function drawSheet(doc: jsPDF, state: EventState, p: Participant) {
  const rows = sheetRows(state, p.id)

  doc.setFillColor(ORANGE)
  doc.rect(M, 14.5, 3, 3, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(GREY)
  doc.text(`${state.title.toUpperCase()} · SPEED MEETING`, M + 6, 17, { charSpace: 0.4 })

  doc.setDrawColor(RULE)
  doc.setLineWidth(0.3)
  doc.line(M, 22, W - M, 22)

  // Nom : réduit d'un cran s'il est long, plutôt que de déborder.
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(INK)
  let nameSize = 24
  while (nameSize > 13 && doc.getStringUnitWidth(p.name) * nameSize * 0.3528 > W - 2 * M) {
    nameSize -= 1
  }
  doc.setFontSize(nameSize)
  doc.text(p.name, M, 36)

  const group = p.group.trim()
  if (group) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(GREY)
    doc.text(group.toUpperCase(), M, 43.5, { charSpace: 0.3 })
  }

  doc.setFontSize(8.5)
  doc.setTextColor(GREY)
  doc.text('TON PARCOURS DE TABLES', M, 56, { charSpace: 0.3 })

  const top = 66
  const bottom = H - 20
  const block = Math.min(34, (bottom - top) / Math.max(1, rows.length))

  rows.forEach((row, i) => {
    const y = top + i * block

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(GREY)
    doc.text(`ROTATION ${row.rotation}`, M, y, { charSpace: 0.3 })

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(Math.min(17, block * 0.62))
    doc.setTextColor(row.table === null ? GREY : ORANGE)
    doc.text(row.table === null ? 'Pas de table' : `Table ${row.table}`, M, y + 8)

    if (row.mates.length > 0) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(GREY)
      const lines = doc.splitTextToSize(`avec ${row.mates.join(' · ')}`, W - 2 * M) as string[]
      doc.text(lines.slice(0, 2), M, y + 13)
    }

    if (i < rows.length - 1) {
      doc.setDrawColor(RULE)
      doc.line(M, y + block - 6, W - M, y + block - 6)
    }
  })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(GREY)
  doc.text(
    `${rows.length} rotation${rows.length > 1 ? 's' : ''} de ${state.rotationMinutes} min · garde cette fiche sous la main`,
    M,
    H - 12,
  )
}

function newDoc() {
  return new jsPDF({ unit: 'mm', format: 'a5', orientation: 'portrait', compress: true })
}

/** Une fiche pour une personne. */
export function sheetPdf(state: EventState, p: Participant): Blob {
  const doc = newDoc()
  drawSheet(doc, state, p)
  return doc.output('blob')
}

/** Toutes les fiches dans un seul PDF, une page par personne. */
export function allSheetsPdf(state: EventState, people: Participant[]): Blob {
  const doc = newDoc()
  people.forEach((p, i) => {
    if (i > 0) doc.addPage()
    drawSheet(doc, state, p)
  })
  return doc.output('blob')
}
