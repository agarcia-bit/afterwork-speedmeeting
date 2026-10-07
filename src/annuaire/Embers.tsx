import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { prefersReducedMotion } from './motion'

export interface EmbersHandle {
  /** Gerbe de braises depuis le bas de l'écran (remerciement). */
  burst: () => void
}

interface Ember {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  alpha: number
  phase: number
  hue: number
  /** Braises de la gerbe : soumises à la gravité, puis éteintes. */
  life?: number
}

const rand = (min: number, max: number) => min + Math.random() * (max - min)

/**
 * Braises qui montent lentement derrière le formulaire, comme la lumière d'un
 * bar. Coût maîtrisé : quelques dizaines de points par image, halo de flou
 * réservé aux plus grosses, pause quand l'onglet est caché. Absentes si
 * l'appareil demande de réduire les animations.
 */
const Embers = forwardRef<EmbersHandle>(function Embers(_, ref) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const sparks = useRef<Ember[]>([])
  const size = useRef({ w: 0, h: 0 })
  const disabled = useRef(prefersReducedMotion())

  useImperativeHandle(ref, () => ({
    burst() {
      if (disabled.current) return
      const { w, h } = size.current
      for (let i = 0; i < 80; i++) {
        const angle = rand(-Math.PI * 0.85, -Math.PI * 0.15)
        const speed = rand(3, 8.5)
        sparks.current.push({
          x: w / 2 + rand(-w * 0.12, w * 0.12),
          y: h + 6,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          r: rand(1, 2.8),
          alpha: rand(0.7, 1),
          phase: rand(0, Math.PI * 2),
          hue: rand(22, 44),
          life: rand(70, 130),
        })
      }
    },
  }))

  useEffect(() => {
    const el = canvas.current
    if (!el || disabled.current) return
    const ctx = el.getContext('2d')
    if (!ctx) return

    let embers: Ember[] = []
    let frame = 0
    let last = performance.now()

    const spawn = (anywhere: boolean): Ember => {
      const { w, h } = size.current
      return {
        x: rand(0, w),
        y: anywhere ? rand(0, h) : h + rand(4, 30),
        vx: 0,
        vy: -rand(0.15, 0.4),
        r: Math.random() < 0.8 ? rand(0.7, 1.6) : rand(1.6, 2.5),
        alpha: rand(0.35, 0.85),
        phase: rand(0, Math.PI * 2),
        hue: rand(24, 42),
      }
    }

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = window.innerWidth
      const h = window.innerHeight
      size.current = { w, h }
      el.width = Math.round(w * dpr)
      el.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const count = Math.max(24, Math.min(70, Math.round((w * h) / 18000)))
      while (embers.length < count) embers.push(spawn(true))
      embers = embers.slice(0, count)
    }

    const draw = (now: number) => {
      const dt = Math.min(3, (now - last) / 16.67)
      last = now
      const { w, h } = size.current
      ctx.clearRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'lighter'

      let glows = 0
      const paint = (e: Ember, alpha: number) => {
        if (alpha <= 0.01) return
        ctx.fillStyle = `hsla(${e.hue}, 100%, ${e.r > 2 ? 68 : 60}%, ${alpha})`
        // Le flou coûte cher : réservé à une dizaine de grosses braises.
        if (e.r > 2 && glows < 10) {
          glows++
          ctx.shadowBlur = 10
          ctx.shadowColor = `hsla(${e.hue}, 100%, 60%, ${alpha})`
        } else {
          ctx.shadowBlur = 0
        }
        ctx.beginPath()
        ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2)
        ctx.fill()
      }

      for (let i = 0; i < embers.length; i++) {
        const e = embers[i]
        e.y += e.vy * dt
        e.x += Math.sin(now * 0.0009 + e.phase) * 0.22 * dt
        if (e.y < -10) embers[i] = spawn(false)
        const breath = 0.6 + 0.4 * Math.sin(now * 0.002 + e.phase)
        // Les braises s'éteignent en approchant du haut de l'écran.
        const fade = Math.min(1, Math.max(0, e.y / (h * 0.18)))
        paint(e, e.alpha * breath * fade)
      }

      const alive: Ember[] = []
      for (const s of sparks.current) {
        s.vx *= 0.985
        s.vy = s.vy * 0.985 + 0.06 * dt
        s.x += s.vx * dt
        s.y += s.vy * dt
        s.life! -= dt
        if (s.life! > 0 && s.y < h + 20) {
          alive.push(s)
          paint(s, s.alpha * Math.min(1, s.life! / 40))
        }
      }
      sparks.current = alive

      frame = requestAnimationFrame(draw)
    }

    const start = () => {
      cancelAnimationFrame(frame)
      last = performance.now()
      frame = requestAnimationFrame(draw)
    }
    const onVisibility = () => (document.hidden ? cancelAnimationFrame(frame) : start())

    resize()
    start()
    window.addEventListener('resize', resize)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  if (disabled.current) return null
  return <canvas ref={canvas} className="embers" aria-hidden="true" />
})

export default Embers
