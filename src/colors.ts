// Palette lisible sur fond sombre, assignée de façon stable à chaque groupe.
const PALETTE = [
  '#e8862a', // orange affiche
  '#4ea1d3',
  '#7ec46b',
  '#e2607f',
  '#b48ee8',
  '#d9c04a',
  '#3fbfae',
  '#f0834f',
  '#8fa5e8',
  '#c98b5a',
  '#68c9e8',
  '#d1699e',
]

export const NO_GROUP_COLOR = '#6d6053'

export function groupColor(group: string): string {
  const g = group.trim()
  if (g === '') return NO_GROUP_COLOR
  let hash = 0
  for (let i = 0; i < g.length; i++) hash = (hash * 31 + g.charCodeAt(i)) | 0
  return PALETTE[Math.abs(hash) % PALETTE.length]
}
