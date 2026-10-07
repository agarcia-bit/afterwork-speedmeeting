import { useEffect, useState } from 'react'

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/**
 * Indique si une séquence d'animation doit jouer, et la termine après
 * `duration` millisecondes.
 *
 * Les séquences sont pilotées en CSS par une classe posée sur la page : sans
 * cette classe, tout est déjà à sa place finale. Ne pas la poser suffit donc à
 * respecter « réduire les animations », et la page reste lisible quoi qu'il
 * arrive. Avec `once`, la séquence ne rejoue pas pendant la session.
 */
export function useSequence({
  duration,
  once,
  enabled = true,
}: {
  duration: number
  once?: string
  enabled?: boolean
}): boolean {
  const [playing, setPlaying] = useState(() => {
    if (!enabled || prefersReducedMotion()) return false
    if (once) {
      try {
        if (sessionStorage.getItem(once)) return false
      } catch {
        // Stockage indisponible : on joue la séquence.
      }
    }
    return true
  })

  useEffect(() => {
    if (!playing) return
    if (once) {
      try {
        sessionStorage.setItem(once, '1')
      } catch {
        // Sans stockage, la séquence rejouera au prochain chargement.
      }
    }
    const timer = window.setTimeout(() => setPlaying(false), duration)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return playing
}
