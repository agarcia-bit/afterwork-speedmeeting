import type { Participant } from './types'

export const NO_GROUP = 'Sans groupe'

export interface Journey {
  person: Participant
  /** Numéro de table à chaque rotation, ou null si la personne n'y est pas. */
  tables: (number | null)[]
}

/**
 * Parcours de chaque personne, regroupés par association (ordre alphabétique,
 * « Sans association » en dernier) et triés par nom à l'intérieur.
 */
export function journeysByGroup(
  rotations: string[][][],
  people: Map<string, Participant>,
): { name: string; members: Journey[] }[] {
  const seats = new Map<string, (number | null)[]>()
  rotations.forEach((rot, r) =>
    rot.forEach((table, t) =>
      table.forEach((id) => {
        const row = seats.get(id) ?? rotations.map(() => null)
        row[r] = t + 1
        seats.set(id, row)
      }),
    ),
  )

  // Toute personne placée dans le plan, plus les présents pas encore placés.
  const ids = new Set(seats.keys())
  for (const p of people.values()) if (p.present) ids.add(p.id)

  const byGroup = new Map<string, Journey[]>()
  for (const id of ids) {
    const person = people.get(id)
    if (!person) continue
    const key = person.group.trim() || NO_GROUP
    const list = byGroup.get(key) ?? []
    list.push({ person, tables: seats.get(id) ?? rotations.map(() => null) })
    byGroup.set(key, list)
  }

  return [...byGroup.entries()]
    .sort(([a], [b]) => (a === NO_GROUP ? 1 : b === NO_GROUP ? -1 : a.localeCompare(b, 'fr')))
    .map(([name, members]) => ({
      name,
      members: members.sort((a, b) => a.person.name.localeCompare(b.person.name, 'fr')),
    }))
}
