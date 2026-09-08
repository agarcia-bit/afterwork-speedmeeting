// Répartition de participants en tables sur plusieurs rotations.
//
// Deux objectifs, par ordre de priorité :
//   1. contrainte dure — jamais deux membres d'un même groupe à la même table ;
//      si c'est mathématiquement impossible, on minimise le nombre de conflits
//      plutôt que d'échouer (repli automatique).
//   2. objectif souple — minimiser les re-rencontres. Le coût d'une paire vue
//      k fois vaut k(k-1)/2 : une 3e rencontre coûte plus cher qu'une 2e, ce qui
//      étale les doublons au lieu de les concentrer sur quelques personnes.
//
// Méthode : construction gloutonne rotation par rotation, puis recuit simulé par
// échanges de deux participants entre deux tables d'une même rotation. Le tout
// relancé plusieurs fois, on garde le meilleur tirage.

export interface SolverParticipant {
  id: string
  group: string
}

export interface SolveOptions {
  participants: SolverParticipant[]
  /** Nombre de participants visé par table. */
  perTable: number
  /** Nombre total de rotations souhaité, rotations verrouillées comprises. */
  rotationCount: number
  /** Rotations déjà jouées, conservées telles quelles (listes d'identifiants). */
  locked?: string[][][]
  /**
   * Tirage actuellement affiché. Il sert de point de départ : une regénération
   * repart de lui et ne le remplace que par strictement mieux, au lieu de
   * relancer les dés à chaque clic.
   */
  current?: string[][][]
  /** Plafond de tirages comparés entre eux. */
  restarts?: number
  /** Temps maximum de recherche, en millisecondes. */
  timeBudgetMs?: number
  seed?: number
}

export interface SolveStats {
  present: number
  tableCount: number
  sizes: number[]
  /** Nombre de paires « même groupe » assises ensemble (toutes rotations). */
  groupConflicts: number
  /** Total des rencontres distribuées (paires × rotations). */
  totalEncounters: number
  /** Paires distinctes qui se sont rencontrées au moins une fois. */
  uniquePairs: number
  /** Rencontres « gâchées » : quelqu'un revoit quelqu'un déjà croisé. */
  repeatEncounters: number
  /** Part des rencontres qui sont des premières rencontres. */
  uniqueRatio: number
  /** Part des paires possibles qui se sont effectivement rencontrées. */
  coverage: number
  /** Nombre maximal de fois qu'une même paire se retrouve ensemble. */
  maxMeet: number
  /** Minimum atteignable, tous tirages confondus. */
  minConflicts: number
  minRepeats: number
  /** Vrai quand le tirage atteint ces minimums : inutile de regénérer. */
  optimal: boolean
}

export interface SolveResult {
  rotations: string[][][]
  stats: SolveStats
}

/** Pénalité d'un conflit de groupe : hors d'atteinte pour l'objectif souple. */
const CONFLICT_COST = 1_000_000

function mulberry32(a: number) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Tailles des tables pour `n` participants avec un objectif de `perTable`.
 * Les tables sont équilibrées (jamais d'écart de plus d'une personne) et on
 * refuse les tables de moins de 2 personnes en réduisant leur nombre.
 */
export function tableSizes(n: number, perTable: number): number[] {
  if (n <= 0) return []
  const target = Math.max(2, Math.floor(perTable))
  if (n <= target) return [n]
  let count = Math.ceil(n / target)
  while (count > 1 && Math.floor(n / count) < 2) count--
  const base = Math.floor(n / count)
  const rem = n % count
  return Array.from({ length: count }, (_, i) => base + (i < rem ? 1 : 0))
}

/**
 * Conflits inévitables sur une rotation : un groupe de `g` personnes réparti
 * au mieux sur `tables` tables laisse forcément des membres ensemble dès que
 * `g > tables`.
 */
function conflictFloor(groups: string[], tables: number): number {
  if (tables < 1) return 0
  const counts = new Map<string, number>()
  for (const g of groups) if (g !== '') counts.set(g, (counts.get(g) ?? 0) + 1)
  let floor = 0
  for (const g of counts.values()) {
    const q = Math.floor(g / tables)
    const r = g % tables
    floor += r * ((q + 1) * q) / 2 + (tables - r) * (q * (q - 1)) / 2
  }
  return floor
}

/**
 * Le mieux qu'un tirage puisse atteindre pour ces rotations : nombre minimal de
 * conflits de groupe, et nombre minimal de re-rencontres (si les rotations
 * distribuent plus de rencontres qu'il n'existe de paires, l'excédent est
 * forcément constitué de doublons). Sert à savoir quand s'arrêter de chercher.
 */
export function planBounds(
  participants: SolverParticipant[],
  rotations: string[][][],
): { minConflicts: number; minRepeats: number } {
  const groups = participants.map((p) => p.group.trim())
  const n = participants.length
  let minConflicts = 0
  let encounters = 0
  for (const rot of rotations) {
    minConflicts += conflictFloor(groups, rot.length)
    for (const table of rot) encounters += (table.length * (table.length - 1)) / 2
  }
  return {
    minConflicts,
    minRepeats: Math.max(0, encounters - (n * (n - 1)) / 2),
  }
}

/** État d'un tirage : matrice des rencontres + score courant. */
class Board {
  readonly n: number
  readonly met: Int32Array
  readonly sameGroup: Uint8Array
  score = 0
  conflicts = 0

  constructor(groups: string[]) {
    this.n = groups.length
    this.met = new Int32Array(this.n * this.n)
    this.sameGroup = new Uint8Array(this.n * this.n)
    for (let i = 0; i < this.n; i++) {
      for (let j = i + 1; j < this.n; j++) {
        if (groups[i] !== '' && groups[i] === groups[j]) {
          this.sameGroup[i * this.n + j] = 1
        }
      }
    }
  }

  private key(i: number, j: number) {
    return i < j ? i * this.n + j : j * this.n + i
  }

  addPair(i: number, j: number) {
    const k = this.key(i, j)
    const m = this.met[k]
    this.score += m // k(k-1)/2 → delta = m
    if (this.sameGroup[k]) {
      this.score += CONFLICT_COST
      this.conflicts++
    }
    this.met[k] = m + 1
  }

  removePair(i: number, j: number) {
    const k = this.key(i, j)
    const m = this.met[k] - 1
    this.met[k] = m
    this.score -= m
    if (this.sameGroup[k]) {
      this.score -= CONFLICT_COST
      this.conflicts--
    }
  }

  addTable(table: number[]) {
    for (let a = 0; a < table.length; a++)
      for (let b = a + 1; b < table.length; b++) this.addPair(table[a], table[b])
  }

  /** Coût d'installer `p` à une table déjà occupée par `table`. */
  seatCost(p: number, table: number[]) {
    let cost = 0
    for (const o of table) {
      const k = this.key(p, o)
      cost += this.met[k]
      if (this.sameGroup[k]) cost += CONFLICT_COST
    }
    return cost
  }
}

/** Construit une rotation gloutonne : chaque personne s'assied là où elle coûte le moins. */
function buildRotation(board: Board, order: number[], sizes: number[], rnd: () => number) {
  const tables: number[][] = sizes.map(() => [])
  for (const p of order) {
    let best = -1
    let bestCost = Infinity
    let ties = 0
    for (let t = 0; t < tables.length; t++) {
      if (tables[t].length >= sizes[t]) continue
      const cost = board.seatCost(p, tables[t])
      if (cost < bestCost) {
        bestCost = cost
        best = t
        ties = 1
      } else if (cost === bestCost) {
        // Choix uniforme parmi les tables ex æquo.
        ties++
        if (rnd() < 1 / ties) best = t
      }
    }
    tables[best].push(p)
  }
  for (const t of tables) board.addTable(t)
  return tables
}

const clonePlan = (plan: number[][][]) => plan.map((rot) => rot.map((table) => [...table]))

/**
 * Recuit simulé : échange deux participants entre deux tables d'une rotation
 * libre. Le recuit accepte des dégradations pour s'échapper des optima locaux,
 * si bien que son état final n'est pas forcément le meilleur qu'il ait vu :
 * on garde donc une copie du meilleur et c'est elle qu'on renvoie.
 */
function anneal(
  board: Board,
  free: number[][][],
  iterations: number,
  rnd: () => number,
  t0 = 3,
): number[][][] {
  if (free.length === 0) return free
  const tableCount = free[0].length
  if (tableCount < 2) return free

  let bestScore = board.score
  let bestPlan = clonePlan(free)
  const t1 = 0.02
  for (let step = 0; step < iterations; step++) {
    const temp = t0 * Math.pow(t1 / t0, step / iterations)

    const r = (rnd() * free.length) | 0
    const tables = free[r]
    let ta = (rnd() * tables.length) | 0
    let tb = (rnd() * tables.length) | 0
    if (ta === tb) tb = (tb + 1) % tables.length
    if (tables[ta].length === 0 || tables[tb].length === 0) continue

    const ia = (rnd() * tables[ta].length) | 0
    const ib = (rnd() * tables[tb].length) | 0
    const a = tables[ta][ia]
    const b = tables[tb][ib]

    const before = board.score
    for (const o of tables[ta]) if (o !== a) board.removePair(a, o)
    for (const o of tables[tb]) if (o !== b) board.removePair(b, o)
    for (const o of tables[ta]) if (o !== a) board.addPair(b, o)
    for (const o of tables[tb]) if (o !== b) board.addPair(a, o)
    const delta = board.score - before

    if (delta <= 0 || rnd() < Math.exp(-delta / temp)) {
      tables[ta][ia] = b
      tables[tb][ib] = a
      if (board.score < bestScore) {
        bestScore = board.score
        bestPlan = clonePlan(free)
      }
    } else {
      // Annulation : on remet les paires d'origine.
      for (const o of tables[ta]) if (o !== a) board.removePair(b, o)
      for (const o of tables[tb]) if (o !== b) board.removePair(a, o)
      for (const o of tables[ta]) if (o !== a) board.addPair(a, o)
      for (const o of tables[tb]) if (o !== b) board.addPair(b, o)
    }
  }
  return bestPlan
}

/** Reconstruit l'état de rencontres correspondant à un tirage. */
function boardFor(groups: string[], locked: number[][][], plan: number[][][]): Board {
  const board = new Board(groups)
  for (const rot of locked) for (const table of rot) board.addTable(table)
  for (const rot of plan) for (const table of rot) board.addTable(table)
  return board
}

function statsFrom(
  board: Board,
  sizes: number[],
  present: number,
  bounds: { minConflicts: number; minRepeats: number },
): SolveStats {
  let totalEncounters = 0
  let uniquePairs = 0
  let maxMeet = 0
  const n = board.n
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const m = board.met[i * n + j]
      if (m > 0) {
        uniquePairs++
        totalEncounters += m
        if (m > maxMeet) maxMeet = m
      }
    }
  }
  const possiblePairs = (present * (present - 1)) / 2
  const repeatEncounters = totalEncounters - uniquePairs
  return {
    present,
    tableCount: sizes.length,
    sizes,
    groupConflicts: board.conflicts,
    totalEncounters,
    uniquePairs,
    repeatEncounters,
    uniqueRatio: totalEncounters === 0 ? 1 : uniquePairs / totalEncounters,
    coverage: possiblePairs === 0 ? 1 : uniquePairs / possiblePairs,
    maxMeet,
    minConflicts: bounds.minConflicts,
    minRepeats: bounds.minRepeats,
    optimal:
      board.conflicts <= bounds.minConflicts && repeatEncounters <= bounds.minRepeats,
  }
}

export function solve(options: SolveOptions): SolveResult {
  const { participants, perTable, rotationCount } = options
  const n = participants.length
  const groups = participants.map((p) => p.group.trim())
  const index = new Map(participants.map((p, i) => [p.id, i]))

  // Rotations verrouillées : on ne garde que les personnes encore présentes.
  const lockedRaw = (options.locked ?? []).slice(0, rotationCount)
  const locked: number[][][] = lockedRaw.map((rot) =>
    rot
      .map((table) => table.map((id) => index.get(id)).filter((i): i is number => i !== undefined))
      .filter((table) => table.length > 0),
  )

  const sizes = tableSizes(n, perTable)
  const freeCount = Math.max(0, rotationCount - locked.length)

  if (n === 0) {
    return { rotations: [], stats: statsFrom(new Board([]), [], 0, { minConflicts: 0, minRepeats: 0 }) }
  }

  // Le meilleur tirage possible, calculé à l'avance : dès qu'on l'atteint, il
  // est inutile de chercher plus loin — et si on ne l'atteint pas dans le temps
  // imparti, c'est le résultat qui le dit, pas un nouveau clic au hasard.
  let encounters = 0
  let floors = 0
  for (let r = 0; r < locked.length + freeCount; r++) {
    const rotSizes = r < locked.length ? locked[r].map((t) => t.length) : sizes
    floors += conflictFloor(groups, rotSizes.length)
    for (const size of rotSizes) encounters += (size * (size - 1)) / 2
  }
  const bounds = {
    minConflicts: floors,
    minRepeats: Math.max(0, encounters - (n * (n - 1)) / 2),
  }
  const target = bounds.minConflicts * CONFLICT_COST + bounds.minRepeats

  const restarts = options.restarts ?? 80
  const deadline = performance.now() + (options.timeBudgetMs ?? 2000)
  // Effort proportionnel à la taille du problème, borné pour rester instantané.
  const iterations = Math.min(1_500_000, Math.max(30_000, n * Math.max(1, freeCount) * 1500))

  let bestRotations: number[][][] | null = null
  let bestBoard: Board | null = null

  // Point de départ : le tirage déjà affiché, s'il correspond toujours aux
  // participants présents et au format de tables demandé.
  const currentFree = (options.current ?? []).slice(locked.length, rotationCount)
  if (currentFree.length === freeCount && freeCount > 0) {
    const mapped = currentFree.map((rot) =>
      rot.map((table) =>
        table.map((id) => index.get(id)).filter((i): i is number => i !== undefined),
      ),
    )
    const usable = mapped.every((rot) => {
      if (rot.map((t) => t.length).join(',') !== sizes.join(',')) return false
      const flat = rot.flat()
      return flat.length === n && new Set(flat).size === n
    })
    if (usable) {
      // Polissage à basse température : on affine le tirage existant au lieu de
      // le casser, et le meilleur état visité inclut le point de départ — un
      // clic de plus ne peut donc jamais dégrader le plan affiché.
      const board = boardFor(groups, locked, mapped)
      const polished = anneal(board, mapped, iterations, mulberry32((options.seed ?? 1) ^ 0x2545f491), 0.8)
      bestRotations = polished
      bestBoard = boardFor(groups, locked, polished)
    }
  }

  // Déjà au minimum atteignable : rien à chercher de plus.
  const alreadyOptimal = bestBoard !== null && bestBoard.score <= target

  for (let run = 0; !alreadyOptimal && run < restarts; run++) {
    const rnd = mulberry32((options.seed ?? 0x9e3779b9) + run * 0x85ebca6b)
    const board = new Board(groups)
    for (const rot of locked) for (const table of rot) board.addTable(table)

    const free: number[][][] = []
    for (let r = 0; r < freeCount; r++) {
      // Les groupes les plus nombreux se placent en premier : ce sont eux qui
      // contraignent le plus le tirage.
      const order = shuffleByGroupSize(groups, rnd)
      free.push(buildRotation(board, order, sizes, rnd))
    }

    const plan = anneal(board, free, iterations, rnd)
    const scored = boardFor(groups, locked, plan)

    if (bestBoard === null || scored.score < bestBoard.score) {
      bestBoard = scored
      bestRotations = plan
    }
    // Optimum prouvé, ou temps imparti écoulé.
    if (bestBoard.score <= target || performance.now() >= deadline) break
  }

  const rotations: string[][][] = [
    ...locked.map((rot) => rot.map((t) => t.map((i) => participants[i].id))),
    ...(bestRotations ?? []).map((rot) => rot.map((t) => t.map((i) => participants[i].id))),
  ]

  return { rotations, stats: statsFrom(bestBoard!, sizes, n, bounds) }
}

/** Ordre de placement : groupes les plus gros d'abord, aléatoire à l'intérieur. */
function shuffleByGroupSize(groups: string[], rnd: () => number): number[] {
  const counts = new Map<string, number>()
  for (const g of groups) if (g !== '') counts.set(g, (counts.get(g) ?? 0) + 1)

  const order = groups.map((_, i) => i)
  for (let i = order.length - 1; i > 0; i--) {
    const j = (rnd() * (i + 1)) | 0
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return order.sort((a, b) => (counts.get(groups[b]) ?? 0) - (counts.get(groups[a]) ?? 0))
}

/**
 * Recalcule les statistiques d'un ensemble de rotations existant (sans re-tirer),
 * pour afficher la qualité après une modification manuelle.
 */
export function statsFor(
  participants: SolverParticipant[],
  rotations: string[][][],
  perTable: number,
): SolveStats {
  const index = new Map(participants.map((p, i) => [p.id, i]))
  const board = new Board(participants.map((p) => p.group.trim()))
  for (const rot of rotations) {
    for (const table of rot) {
      const idx = table.map((id) => index.get(id)).filter((i): i is number => i !== undefined)
      board.addTable(idx)
    }
  }
  return statsFrom(
    board,
    tableSizes(participants.length, perTable),
    participants.length,
    planBounds(participants, rotations),
  )
}
