// Analyse d'une liste collée (tableur, mail, document) avant import.
//
// Le point clé : on décide d'un séparateur et d'une disposition pour
// l'ensemble du texte, pas ligne par ligne. Deviner localement fait exploser
// « Dupont, Jean » en deux colonnes alors que c'est un seul nom — d'où un
// aperçu systématique, et des réglages que l'organisateur peut corriger.

export type Separator = '\t' | ';' | '|' | ','
export type Layout = 'name' | 'name-group' | 'group-name'

export interface ParseOptions {
  separator?: Separator | null
  layout?: Layout
  header?: boolean
}

export interface ParsedRow {
  name: string
  group: string
  /** Déjà présent dans la liste des participants. */
  duplicate: boolean
}

export interface ParseResult {
  rows: ParsedRow[]
  separator: Separator | null
  layout: Layout
  header: boolean
  /** Nombre de lignes de données (en-tête exclu). */
  total: number
  duplicates: number
}

const SEPARATORS: Separator[] = ['\t', ';', '|', ',']

const HEADER_WORDS =
  /^(nom|noms|name|names|prénom|prenom|participant|participants|groupe|group|association|asso|structure|société|societe|entreprise)$/i

const GROUP_WORDS = /^(groupe|group|association|asso|structure|société|societe|entreprise)$/i

/** Comparaison de noms tolérante aux accents, à la casse et aux espaces. */
export function nameKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function unquote(value: string): string {
  const v = value.trim()
  return v.length > 1 && v.startsWith('"') && v.endsWith('"')
    ? v.slice(1, -1).replace(/""/g, '"').trim()
    : v
}

function splitLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
}

/**
 * Séparateur retenu : celui qui découpe la grande majorité des lignes.
 * Le point-virgule et la tabulation l'emportent sur la virgule, qui apparaît
 * aussi dans les noms eux-mêmes.
 */
export function detectSeparator(lines: string[]): Separator | null {
  if (lines.length === 0) return null
  for (const sep of SEPARATORS) {
    const hits = lines.filter((l) => l.includes(sep)).length
    if (hits >= Math.max(1, Math.ceil(lines.length * 0.6))) return sep
  }
  return null
}

function detectHeader(fields: string[]): boolean {
  return fields.length > 0 && fields.every((f) => HEADER_WORDS.test(f))
}

/** Découpe le texte en cellules, une ligne par entrée. */
export function toCells(
  text: string,
  separator?: Separator | null,
): { cells: string[][]; raw: string[]; separator: Separator | null } {
  const raw = splitLines(text)
  const sep = separator !== undefined ? separator : detectSeparator(raw)
  return {
    raw,
    separator: sep,
    cells: raw.map((line) => (sep ? line.split(sep).map(unquote) : [unquote(line)])),
  }
}

/**
 * Transforme des cellules en participants, quelle que soit leur provenance —
 * texte collé ou feuille de calcul. `raw` ne sert qu'au texte : en disposition
 * « nom seul », c'est la ligne d'origine qui fait le nom, séparateurs compris.
 */
export function fromCells(
  cells: string[][],
  existing: Iterable<string> = [],
  options: ParseOptions = {},
  raw?: string[],
): ParseResult {
  const firstFields = cells[0] ?? []
  const header = options.header ?? detectHeader(firstFields)

  let layout: Layout
  if (options.layout) {
    layout = options.layout
  } else if (cells.every((row) => row.filter(Boolean).length < 2)) {
    layout = 'name'
  } else if (header && GROUP_WORDS.test(firstFields[0] ?? '')) {
    layout = 'group-name'
  } else {
    layout = 'name-group'
  }

  const seen = new Set([...existing].map(nameKey))
  const start = header ? 1 : 0
  const rows: ParsedRow[] = []

  for (let i = start; i < cells.length; i++) {
    const fields = cells[i]
    let name: string
    let group: string

    if (layout === 'name') {
      name = raw ? (raw[i] ?? '') : (fields[0] ?? '')
      group = ''
    } else {
      const head = fields[0] ?? ''
      // Tout ce qui dépasse deux colonnes rejoint la seconde plutôt que d'être perdu.
      const tail = fields.slice(1).filter(Boolean).join(' ')
      ;[name, group] = layout === 'group-name' ? [tail, head] : [head, tail]
    }

    name = name.trim()
    if (name === '') continue
    const key = nameKey(name)
    rows.push({ name, group: group.trim(), duplicate: seen.has(key) })
    seen.add(key)
  }

  return {
    rows,
    separator: null,
    layout,
    header,
    total: rows.length,
    duplicates: rows.filter((r) => r.duplicate).length,
  }
}

/**
 * Lit le texte collé. `options` permet de forcer ce que la détection a mal
 * deviné ; tout ce qui n'est pas fourni est détecté.
 */
export function parseList(
  text: string,
  existing: Iterable<string> = [],
  options: ParseOptions = {},
): ParseResult {
  const { cells, raw, separator } = toCells(text, options.separator)
  return { ...fromCells(cells, existing, options, raw), separator }
}
