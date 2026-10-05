// Lecture et écriture minimales du format .xlsx.
//
// Un classeur Excel est une archive ZIP de fichiers XML. On n'a besoin ici que
// de texte sur deux colonnes : écrire un modèle à remplir, et relire celui que
// l'organisateur renvoie. Écrire ces quelques XML à la main évite d'embarquer
// une bibliothèque de tableur de plusieurs centaines de kilo-octets dans une
// application qui doit rester légère et utilisable hors ligne.
import { unzipSync, zipSync, strToU8 } from 'fflate'

const SHEET_NAME = 'Participants'

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Référence de colonne Excel : 0 → A, 25 → Z, 26 → AA. */
function columnName(index: number): string {
  let name = ''
  let n = index
  do {
    name = String.fromCharCode(65 + (n % 26)) + name
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return name
}

function columnIndex(ref: string): number {
  const letters = ref.replace(/[^A-Z]/g, '')
  let index = 0
  for (const ch of letters) index = index * 26 + (ch.charCodeAt(0) - 64)
  return index - 1
}

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

/** Construit un classeur d'une feuille, toutes cellules en texte. */
export function buildXlsx(rows: string[][]): Blob {
  const sheetRows = rows
    .map((cells, r) => {
      const cs = cells
        .map((value, c) =>
          value === ''
            ? ''
            : `<c r="${columnName(c)}${r + 1}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`,
        )
        .join('')
      return `<row r="${r + 1}">${cs}</row>`
    })
    .join('')

  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(
      `${XML_HEADER}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '</Types>',
    ),
    '_rels/.rels': strToU8(
      `${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="${NS_REL}/officeDocument" Target="xl/workbook.xml"/>` +
        '</Relationships>',
    ),
    'xl/workbook.xml': strToU8(
      `${XML_HEADER}<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">` +
        `<sheets><sheet name="${SHEET_NAME}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      `${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="${NS_REL}/worksheet" Target="worksheets/sheet1.xml"/>` +
        '</Relationships>',
    ),
    'xl/worksheets/sheet1.xml': strToU8(
      `${XML_HEADER}<worksheet xmlns="${NS_MAIN}">` +
        '<cols><col min="1" max="1" width="30" customWidth="1"/><col min="2" max="2" width="26" customWidth="1"/></cols>' +
        `<sheetData>${sheetRows}</sheetData></worksheet>`,
    ),
  }

  return new Blob([zipSync(files) as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

function textOf(node: Element | null): string {
  return node ? (node.textContent ?? '') : ''
}

/**
 * Relit la première feuille d'un classeur et en renvoie les cellules, ligne par
 * ligne. Les trous sont comblés pour que chaque colonne reste alignée.
 */
export function readXlsx(data: ArrayBuffer): string[][] {
  const zip = unzipSync(new Uint8Array(data))
  const decoder = new TextDecoder()
  const read = (path: string) => (zip[path] ? decoder.decode(zip[path]) : null)
  const parser = new DOMParser()

  // Chaînes partagées : Excel y déporte le texte des cellules.
  const shared: string[] = []
  const sharedXml = read('xl/sharedStrings.xml')
  if (sharedXml) {
    const doc = parser.parseFromString(sharedXml, 'application/xml')
    for (const si of Array.from(doc.getElementsByTagName('si'))) {
      // Un texte mis en forme est découpé en plusieurs <t> qu'il faut recoller.
      shared.push(
        Array.from(si.getElementsByTagName('t'))
          .map((t) => t.textContent ?? '')
          .join(''),
      )
    }
  }

  const sheetPath =
    Object.keys(zip).find((p) => p === 'xl/worksheets/sheet1.xml') ??
    Object.keys(zip).find((p) => p.startsWith('xl/worksheets/') && p.endsWith('.xml'))
  const sheetXml = sheetPath ? read(sheetPath) : null
  if (!sheetXml) throw new Error('Feuille de calcul introuvable dans le fichier.')

  const doc = parser.parseFromString(sheetXml, 'application/xml')
  const rows: string[][] = []

  for (const row of Array.from(doc.getElementsByTagName('row'))) {
    const cells: string[] = []
    for (const c of Array.from(row.getElementsByTagName('c'))) {
      const ref = c.getAttribute('r')
      const at = ref ? columnIndex(ref) : cells.length
      const type = c.getAttribute('t')

      let value: string
      if (type === 's') {
        const index = Number(textOf(c.getElementsByTagName('v')[0] ?? null))
        value = shared[index] ?? ''
      } else if (type === 'inlineStr') {
        value = Array.from(c.getElementsByTagName('t'))
          .map((t) => t.textContent ?? '')
          .join('')
      } else {
        // Nombre, date ou résultat de formule : la valeur brute suffit.
        value = textOf(c.getElementsByTagName('v')[0] ?? null)
      }

      while (cells.length < at) cells.push('')
      cells[at] = value.trim()
    }
    rows.push(cells)
  }

  // On ignore les lignes entièrement vides, fréquentes en fin de feuille.
  return rows.filter((r) => r.some((cell) => cell !== ''))
}
