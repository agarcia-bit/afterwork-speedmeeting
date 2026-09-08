export interface Participant {
  id: string
  name: string
  group: string
  present: boolean
}

export interface EventState {
  title: string
  participants: Participant[]
  /** Nombre de participants visé par table. */
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
  perTable: 5,
  rotationCount: 4,
  rotationMinutes: 12,
  rotations: [],
  lockedCount: 0,
})
