import { useEffect, useRef } from 'react'
import type { MiniGameModule } from '../../games/types'
import { audioManager } from '../../services/audio/AudioManager'

interface Props {
  game: MiniGameModule
  preview?: boolean
  active?: boolean
  paused?: boolean
  onScore?: (score: number) => void
  onFinish?: (score: number) => void
}

export function GameCanvas({ game, preview = false, active = true, paused = false, onScore, onFinish }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const controllerRef = useRef<ReturnType<MiniGameModule['createController']> | null>(null)
  const pausedRef = useRef(paused)
  const callbacks = useRef({ onScore, onFinish })
  callbacks.current = { onScore, onFinish }

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas || !active) return
    const context = canvas.getContext('2d', { alpha: false }); if (!context) return
    const controller = game.createController({
      preview,
      onScore: (score) => callbacks.current.onScore?.(score),
      onFinish: (score) => callbacks.current.onFinish?.(score),
      onImpact: (kind) => audioManager.play(kind),
    })
    controllerRef.current = controller
    let frame = 0, last = performance.now(), cssWidth = 0, cssHeight = 0
    const resize = () => {
      const rect = canvas.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1)
      cssWidth = rect.width; cssHeight = rect.height; canvas.width = Math.round(cssWidth * dpr); canvas.height = Math.round(cssHeight * dpr); controller.resize(cssWidth, cssHeight, dpr)
    }
    const observer = new ResizeObserver(resize); observer.observe(canvas); resize()
    const loop = (time: number) => {
      const dt = Math.min(.05, (time - last) / 1000); last = time; controller.update(dt)
      const dpr = canvas.width / Math.max(1, cssWidth); context.setTransform(dpr, 0, 0, dpr, 0, 0); controller.render(context)
      frame = requestAnimationFrame(loop)
    }
    const point = (event: PointerEvent) => { const rect = canvas.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top } }
    let down: { x: number; y: number } | null = null
    const handleDown = (event: PointerEvent) => { if (preview) return; canvas.setPointerCapture(event.pointerId); down = point(event); controller.pointerDown(down.x, down.y) }
    const handleMove = (event: PointerEvent) => { if (preview || !down) return; const p = point(event); controller.pointerMove(p.x, p.y) }
    const handleUp = (event: PointerEvent) => { if (preview || !down) return; const p = point(event); controller.pointerUp(p.x, p.y); down = null }
    canvas.addEventListener('pointerdown', handleDown); canvas.addEventListener('pointermove', handleMove); canvas.addEventListener('pointerup', handleUp); canvas.addEventListener('pointercancel', handleUp)
    frame = requestAnimationFrame(loop)
    const visibility = () => document.hidden || pausedRef.current ? controller.pause() : controller.resume(); document.addEventListener('visibilitychange', visibility)
    return () => { cancelAnimationFrame(frame); observer.disconnect(); document.removeEventListener('visibilitychange', visibility); canvas.removeEventListener('pointerdown', handleDown); canvas.removeEventListener('pointermove', handleMove); canvas.removeEventListener('pointerup', handleUp); canvas.removeEventListener('pointercancel', handleUp); controller.destroy(); controllerRef.current = null }
  }, [active, game, preview])

  useEffect(() => { pausedRef.current = paused; if (!active) return; if (paused) controllerRef.current?.pause(); else controllerRef.current?.resume() }, [active, paused])

  return <canvas className="game-canvas" ref={canvasRef} aria-label={`${game.title} ${preview ? '미리보기' : '게임 화면'}`} />
}
