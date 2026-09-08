export interface Participant {
  id: string
  name: string
  group: string
  present: boolean
}

export interface EventState {
  title: string
  participants: Participant[]
  /** Ce que l'organisateur fixe : le nombre de tables, ou les places par table. */
  tableMode: 'count' | 'perTable'
  /** Nombre de tables de la salle (utilisé quand tableMode vaut 'count'). */
  tableCount: number
  /** Nombre de participants visé par table (utilisé quand tableMode vaut 'perTable'). */
  perTable: number
  /** Nombre de rotations souhaité. */
  rotationCount: number
  /** Durée d'une rotation, en minutes (minuteur du mode écran). */
  rotationMinutes: number
  /** Le tirage courant : rotations → tables → identifiants de participants. */
  rotations: string[][][]
  /** Nombre de rotations déjà jouées, figées lors des regénérations. */
  lockedCount: number
}

export const emptyEvent = (): EventState => ({
  title: 'Afterwork INTERASSO',
  participants: [],
  tableMode: 'count',
  tableCount: 5,
  perTable: 5,
  rotationCount: 4,
  rotationMinutes: 12,
  rotations: [],
  lockedCount: 0,
})
