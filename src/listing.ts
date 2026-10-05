// Listings PDF du plan, mis en page pour l'impression ou l'envoi — et non une
// capture de la page web. Fond blanc, accents orange, en-tête et numéros de
// page sur chaque feuille.
import { jsPDF } from 'jspdf'
import type { Participant } from './types'
import { journeysByGroup } from './journeys'
import { LOGO_14_AVENUE, LOGO_RATIO } from './logo'

const INK = '#1c1712'
const GREY = '#7d7166'
const ORANGE = '#d97219'
const RULE = '#ddd2c4'
const ZEBRA = '#f7f2eb'

interface Page {
  doc: jsPDF
  W: number
  H: number
  M: number
  title: string
  label: string
}

/** En-tête commun à chaque feuille ; renvoie l'ordonnée où commence le contenu. */
function header(p: Page): number {
  const { doc, M, W } = p
  const logoW = 12
  doc.addImage(LOGO_14_AVENUE, 'PNG', W - M - logoW, 7, logoW, logoW * LOGO_RATIO)
  doc.setFillColor(ORANGE)
  doc.rect(M, 13, 2.6, 2.6, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(GREY)
  doc.text(`${p.title.toUpperCase()} · ${p.label.toUpperCase()}`, M + 5, 15.3, { charSpace: 0.4 })
  doc.setDrawColor(RULE)
  doc.setLineWidth(0.3)
  doc.line(M, 23, W - M, 23)
  return 31
}

/** Pied de page, posé une fois le document complet pour connaître le total. */
function footers(p: Page) {
  const { doc, M, W, H } = p
  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(GREY)
    doc.text(p.title, M, H - 8)
    doc.text(`Page ${i} / ${total}`, W - M, H - 8, { align: 'right' })
  }
}

/** Raccourcit un texte avec « … » pour qu'il tienne dans `width` millimètres. */
function fit(doc: jsPDF, text: string, width: number): string {
  if (doc.getTextWidth(text) <= width) return text
  let t = text
  while (t.length > 1 && doc.getTextWidth(`${t}…`) > width) t = t.slice(0, -1)
  return `${t.trimEnd()}…`
}

function titleBlock(p: Page, y: number, title: string, accent: string, sub: string): number {
  const { doc, M } = p
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(INK)
  doc.text(title, M, y + 6)
  if (accent) {
    doc.setTextColor(ORANGE)
    doc.text(accent, M + doc.getTextWidth(`${title} `) + 0.5, y + 6)
  }
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(GREY)
  doc.text(sub, M, y + 12.5)
  return y + 21
}

// ---------------------------------------------------------------------------

/**
 * Parcours de chaque personne, une association par page — chaque page peut
 * ainsi être remise ou envoyée à l'association concernée. A4 portrait.
 */
export function personListingPdf(
  title: string,
  rotations: string[][][],
  people: Map<string, Participant>,
): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true })
  const p: Page = { doc, W: 210, H: 297, M: 16, title, label: 'Parcours par personne' }
  const groups = journeysByGroup(rotations, people)

  const R = rotations.length
  const colW = Math.min(14, 100 / Math.max(1, R))
  const nameW = p.W - 2 * p.M - colW * R
  const rowH = 6.4
  const bottom = p.H - 18

  const columnHeads = (yy: number) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(GREY)
    doc.text('NOM', p.M, yy, { charSpace: 0.3 })
    for (let r = 0; r < R; r++) {
      doc.text(`R${r + 1}`, p.M + nameW + colW * r + colW / 2, yy, { align: 'center' })
    }
    doc.setDrawColor(RULE)
    doc.setLineWidth(0.25)
    doc.line(p.M, yy + 2, p.W - p.M, yy + 2)
    return yy + 3
  }

  const groupTop = (name: string, n: number, cont: boolean) => {
    const sub = `${n} personne${n > 1 ? 's' : ''} · ${R} rotation${R > 1 ? 's' : ''}`
    const y = titleBlock(p, header(p), name, cont ? '(suite)' : '', sub)
    // Petit filet d'accent sous le nom de l'association.
    doc.setDrawColor(ORANGE)
    doc.setLineWidth(0.8)
    doc.line(p.M, y - 5, p.M + 16, y - 5)
    return columnHeads(y + 2)
  }

  groups.forEach((group, gi) => {
    if (gi > 0) doc.addPage()
    let y = groupTop(group.name, group.members.length, false)

    group.members.forEach((j, i) => {
      if (y + rowH > bottom) {
        doc.addPage()
        y = groupTop(group.name, group.members.length, true)
      }
      if (i % 2 === 1) {
        doc.setFillColor(ZEBRA)
        doc.rect(p.M - 1.5, y, p.W - 2 * p.M + 3, rowH, 'F')
      }
      const base = y + rowH / 2 + 1.3
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9.5)
      doc.setTextColor(INK)
      doc.text(fit(doc, j.person.name, nameW - 3), p.M, base)

      doc.setFont('helvetica', 'bold')
      j.tables.forEach((t, r) => {
        const cx = p.M + nameW + colW * r + colW / 2
        doc.setTextColor(t === null ? RULE : ORANGE)
        doc.text(t === null ? '—' : String(t), cx, base, { align: 'center' })
      })
      y += rowH
    })
  })

  footers(p)
  return doc.output('blob')
}

// ---------------------------------------------------------------------------

/** Plan de salle, une rotation par page (ou plus si nécessaire). A4 paysage. */
export function tableListingPdf(
  title: string,
  rotations: string[][][],
  people: Map<string, Participant>,
  minutes: number,
): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape', compress: true })
  const p: Page = { doc, W: 297, H: 210, M: 14, title, label: 'Plan des tables' }
  const bottom = p.H - 16
  const gap = 5
  const pad = 4
  const headH = 11

  rotations.forEach((rot, r) => {
    if (r > 0) doc.addPage()
    const tables = rot.length
    const sub = `${tables} table${tables > 1 ? 's' : ''} · ${minutes} min`
    const top = titleBlock(p, header(p), 'Rotation', String(r + 1), sub)

    const names = rot.map((ids) =>
      ids
        .map((id) => people.get(id)?.name)
        .filter((n): n is string => Boolean(n))
        .sort((a, b) => a.localeCompare(b, 'fr')),
    )

    // Mise en page d'une rotation pour un nombre de colonnes et une taille de
    // texte donnés : largeur des cartes, noms passés à la ligne, hauteur totale.
    const layoutFor = (cols: number, size: number) => {
      const cardW = (p.W - 2 * p.M - gap * (cols - 1)) / cols
      const lineH = size * 0.47
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(size)
      const cards = names.map((list, t) => {
        const lines = list.map((n) => doc.splitTextToSize(n, cardW - 2 * pad - 3) as string[])
        const count = lines.reduce((n, l) => n + l.length, 0)
        return { number: t + 1, lines, h: headH + pad + count * lineH + pad - 1 }
      })
      const rows: (typeof cards)[] = []
      for (let i = 0; i < cards.length; i += cols) rows.push(cards.slice(i, i + cols))
      const total =
        rows.reduce((sum, row) => sum + Math.max(...row.map((c) => c.h)), 0) +
        gap * (rows.length - 1)
      return { cols, cardW, size, lineH, rows, total }
    }

    // On cherche une rotation par page : le moins de colonnes possible (des
    // cartes larges, peu de noms coupés), puis une taille de texte réduite si
    // nécessaire. Faute de mieux, la rotation continue sur une page suivante.
    const columnChoices = [...new Set([1, 2, 3, 4, 5, 6].map((n) => Math.ceil(tables / n)))]
      .filter((c) => c <= 8)
      .sort((a, b) => a - b)
    let layout = null as ReturnType<typeof layoutFor> | null
    search: for (const size of [9.5, 9, 8.5, 8, 7.5]) {
      for (const cols of columnChoices) {
        const candidate = layoutFor(cols, size)
        if (top + candidate.total <= bottom) {
          layout = candidate
          break search
        }
      }
    }
    layout ??= layoutFor(Math.min(tables, 6), 7.5)

    let y = top
    for (const row of layout.rows) {
      const rowH = Math.max(...row.map((c) => c.h))
      if (y + rowH > bottom) {
        doc.addPage()
        y = titleBlock(p, header(p), 'Rotation', `${r + 1} (suite)`, sub)
      }

      row.forEach((card, i) => {
        const x = p.M + i * (layout.cardW + gap)
        doc.setDrawColor(RULE)
        doc.setLineWidth(0.3)
        doc.roundedRect(x, y, layout.cardW, rowH, 2.5, 2.5, 'S')
        doc.setFillColor(ORANGE)
        doc.rect(x + 2.5, y, layout.cardW - 5, 0.8, 'F')

        doc.circle(x + pad + 3.4, y + 6.2, 3.4, 'F')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(card.number > 9 ? 8 : 9.5)
        doc.setTextColor('#ffffff')
        doc.text(String(card.number), x + pad + 3.4, y + 7.5, { align: 'center' })
        doc.setFontSize(7.5)
        doc.setTextColor(GREY)
        doc.text('TABLE', x + pad + 9, y + 7.3, { charSpace: 0.5 })

        doc.setDrawColor(RULE)
        doc.line(x + pad, y + headH, x + layout.cardW - pad, y + headH)

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(layout.size)
        doc.setTextColor(INK)
        let ly = y + headH + pad + 2
        for (const lines of card.lines) {
          // Suite d'un nom trop long : en retrait, pour ne pas la lire comme
          // une personne de plus.
          lines.forEach((line, k) => {
            doc.text(line, x + pad + (k > 0 ? 3 : 0), ly)
            ly += layout.lineH
          })
        }
      })
      y += rowH + gap
    }
  })

  footers(p)
  return doc.output('blob')
}

// ---------------------------------------------------------------------------

/**
 * Annuaire de tous les présents de la soirée — pas seulement les personnes
 * rencontrées — pour que chacun reparte avec la liste complète. Classé par
 * groupe, noms sur trois colonnes lues de haut en bas. A4 portrait.
 */
export function attendeeListPdf(title: string, people: Map<string, Participant>): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true })
  const p: Page = { doc, W: 210, H: 297, M: 16, title, label: 'Participants de la soirée' }
  // Sans tirage, le regroupement ne retient que les présents.
  const groups = journeysByGroup([], people)
  const count = groups.reduce((n, g) => n + g.members.length, 0)

  const cols = 3
  const colGap = 6
  const colW = (p.W - 2 * p.M - colGap * (cols - 1)) / cols
  const rowH = 5.8
  const bottom = p.H - 18

  let y = titleBlock(
    p,
    header(p),
    'Participants de la soirée',
    '',
    `${count} participant${count > 1 ? 's' : ''} · ${groups.length} groupe${groups.length > 1 ? 's' : ''}`,
  )

  const groupHead = (yy: number, name: string, n: number, cont: boolean) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(INK)
    doc.text(name.toUpperCase(), p.M, yy)
    if (cont) {
      const w = doc.getTextWidth(name.toUpperCase())
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(GREY)
      doc.text('(suite)', p.M + w + 2.5, yy)
    }
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(GREY)
    doc.text(`${n} personne${n > 1 ? 's' : ''}`, p.W - p.M, yy, { align: 'right' })
    doc.setDrawColor(ORANGE)
    doc.setLineWidth(0.6)
    doc.line(p.M, yy + 2.2, p.M + 14, yy + 2.2)
    doc.setDrawColor(RULE)
    doc.setLineWidth(0.25)
    doc.line(p.M + 14, yy + 2.2, p.W - p.M, yy + 2.2)
    return yy + 8
  }

  for (const group of groups) {
    const names = group.members.map((m) => m.person.name)
    // Un groupe qui tient sur une page n'est jamais coupé : s'il ne tient plus
    // dans la place restante, il passe en entier à la page suivante. Seuls les
    // groupes plus longs qu'une page continuent d'une page à l'autre.
    const needed = 11 + rowH * Math.ceil(names.length / cols)
    const freshPage = bottom - 31
    if (y + needed > bottom && (needed <= freshPage || y + 11 + rowH * 2 > bottom)) {
      doc.addPage()
      y = header(p)
    }
    y = groupHead(y + 3, group.name, names.length, false)

    let rest = names
    while (rest.length > 0) {
      const rowsFit = Math.max(1, Math.floor((bottom - y) / rowH))
      const chunk = rest.slice(0, rowsFit * cols)
      rest = rest.slice(chunk.length)
      // Lecture en colonnes : l'ordre alphabétique descend, puis passe à droite.
      const rows = Math.ceil(chunk.length / cols)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9.5)
      doc.setTextColor(INK)
      chunk.forEach((name, i) => {
        const c = Math.floor(i / rows)
        const r = i % rows
        doc.text(fit(doc, name, colW - 2), p.M + c * (colW + colGap), y + r * rowH + 4)
      })
      y += rows * rowH
      if (rest.length > 0) {
        doc.addPage()
        y = groupHead(header(p) + 3, group.name, names.length, true)
      }
    }
    y += 4
  }

  footers(p)
  return doc.output('blob')
}
