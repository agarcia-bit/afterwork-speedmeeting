import { emptyEvent, type EventState } from './types'

const KEY = 'afterwork-speedmeeting/v1'

export function load(): EventState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return emptyEvent()
    const parsed = JSON.parse(raw)
    return normalize(parsed)
  } catch {
    return emptyEvent()
  }
}

export function save(state: EventState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // Navigation privée ou stockage plein : l'appli reste utilisable en mémoire.
  }
}

/** Complète un état venant du stockage ou d'un fichier importé. */
export function normalize(input: unknown): EventState {
  const base = emptyEvent()
  if (typeof input !== 'object' || input === null) return base
  const raw = input as Partial<EventState>
  const participants = Array.isArray(raw.participants)
    ? raw.participants
        .filter((p) => p && typeof p.name === 'string')
        .map((p, i) => ({
          id: typeof p.id === 'string' ? p.id : `p${i}-${Math.random().toString(36).slice(2, 8)}`,
          name: p.name,
          group: typeof p.group === 'string' ? p.group : '',
          present: p.present !== false,
        }))
    : []
  const ids = new Set(participants.map((p) => p.id))
  const rotations = Array.isArray(raw.rotations)
    ? raw.rotations.map((rot) =>
        (Array.isArray(rot) ? rot : []).map((table) =>
          (Array.isArray(table) ? table : []).filter((id) => ids.has(id)),
        ),
      )
    : []
  return {
    title: typeof raw.title === 'string' ? raw.title : base.title,
    participants,
    perTable: clamp(raw.perTable, 2, 12, base.perTable),
    rotationCount: clamp(raw.rotationCount, 1, 12, base.rotationCount),
    rotationMinutes: clamp(raw.rotationMinutes, 1, 60, base.rotationMinutes),
    rotations,
    lockedCount: clamp(raw.lockedCount, 0, rotations.length, 0),
  }
}

function clamp(value: unknown, min: number, max: number, fallback: number) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}
