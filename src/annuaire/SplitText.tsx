import type { CSSProperties } from 'react'

/**
 * Découpe un mot en lettres animables une à une. Les lettres sont masquées
 * aux lecteurs d'écran : le titre parent porte le texte complet en aria-label.
 */
export default function SplitText({ text, className }: { text: string; className?: string }) {
  return (
    <span className={className}>
      {Array.from(text).map((ch, i) => (
        <span
          key={i}
          className="char"
          aria-hidden="true"
          style={{ '--i': i } as CSSProperties}
        >
          {ch === ' ' ? ' ' : ch}
        </span>
      ))}
    </span>
  )
}
