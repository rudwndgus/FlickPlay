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
      onImpact: preview ? () => {} : (kind) => audioManager.play(kind),
    })
    controllerRef.current = controller
    let frame = 0, last = performance.now(), cssWidth = 0, cssHeight = 0, initialized = false
    const render = () => { const dpr = canvas.width / Math.max(1, cssWidth); context.setTransform(dpr, 0, 0, dpr, 0, 0); controller.render(context) }
    const resize = () => {
      const rect = canvas.getBoundingClientRect(), dprLimit = preview ? 1 : game.id === 'perfect-stack' ? 1.5 : 2, dpr = Math.min(dprLimit, window.devicePixelRatio || 1)
      const nextWidth = rect.width, nextHeight = rect.height, pixelWidth = Math.round(nextWidth * dpr), pixelHeight = Math.round(nextHeight * dpr)
      if (initialized && nextWidth === cssWidth && nextHeight === cssHeight && canvas.width === pixelWidth && canvas.height === pixelHeight) return
      cssWidth = nextWidth; cssHeight = nextHeight; canvas.width = pixelWidth; canvas.height = pixelHeight; controller.resize(cssWidth, cssHeight, dpr)
      if (!initialized && cssWidth > 0 && cssHeight > 0) { initialized = true; controller.restart() }
      if (initialized) render()
    }
    const observer = new ResizeObserver(resize); observer.observe(canvas); resize()
    const loop = (time: number) => {
      frame = requestAnimationFrame(loop)
      if (pausedRef.current || document.hidden || !initialized) { last = time; return }
      const dt = Math.min(.05, (time - last) / 1000); last = time; controller.update(dt); render()
    }
    const point = (event: PointerEvent) => { const rect = canvas.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top } }
    let down: { x: number; y: number; pointerId: number } | null = null
    const handleDown = (event: PointerEvent) => { if (preview || down) return; canvas.setPointerCapture(event.pointerId); const p = point(event); down = { ...p, pointerId: event.pointerId }; controller.pointerDown(p.x, p.y) }
    const handleMove = (event: PointerEvent) => { if (preview || !down || event.pointerId !== down.pointerId) return; const p = point(event); controller.pointerMove(p.x, p.y) }
    const handleUp = (event: PointerEvent) => { if (preview || !down || event.pointerId !== down.pointerId) return; const p = point(event); controller.pointerUp(p.x, p.y); down = null }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (preview || event.repeat) return
      const directions: Record<string, [number, number]> = { ArrowUp: [0, -70], w: [0, -70], W: [0, -70], ArrowDown: [0, 70], s: [0, 70], S: [0, 70], ArrowLeft: [-70, 0], a: [-70, 0], A: [-70, 0], ArrowRight: [70, 0], d: [70, 0], D: [70, 0] }
      const direction = directions[event.key]
      if (direction) { event.preventDefault(); controller.swipe?.(...direction) }
      if (event.key === 'r' || event.key === 'R') controller.restart()
    }
    if (!preview) {
      canvas.addEventListener('pointerdown', handleDown); canvas.addEventListener('pointermove', handleMove); canvas.addEventListener('pointerup', handleUp); canvas.addEventListener('pointercancel', handleUp)
      window.addEventListener('keydown', handleKeyDown)
    }
    frame = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(frame); observer.disconnect(); if (!preview) { window.removeEventListener('keydown', handleKeyDown); canvas.removeEventListener('pointerdown', handleDown); canvas.removeEventListener('pointermove', handleMove); canvas.removeEventListener('pointerup', handleUp); canvas.removeEventListener('pointercancel', handleUp) } controller.destroy(); controllerRef.current = null }
  }, [active, game, preview])

  useEffect(() => { pausedRef.current = paused; if (!active) return; if (paused) controllerRef.current?.pause(); else controllerRef.current?.resume() }, [active, paused])

  return <canvas className="game-canvas" ref={canvasRef} aria-label={`${game.title} ${preview ? '미리보기' : '게임 화면'}`} />
}
