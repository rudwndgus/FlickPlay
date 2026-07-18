export type GameStatus = 'ready' | 'playing' | 'paused' | 'finished'

export interface GameTheme {
  background: string
  surface: string
  accent: string
  accent2: string
  text: string
  muted: string
  headerStyle: 'light' | 'dark' | 'glass' | 'neon' | 'pixel'
}

export interface GameControlGuide {
  label: string
  description: string
}

export interface ScoringRule {
  label: string
  value: string
}

export interface GameController {
  resize(width: number, height: number, dpr: number): void
  update(dt: number): void
  render(ctx: CanvasRenderingContext2D): void
  pointerDown(x: number, y: number): void
  pointerMove(x: number, y: number): void
  pointerUp(x: number, y: number): void
  swipe?(dx: number, dy: number): void
  autopilot?(elapsed: number): void
  pause(): void
  resume(): void
  restart(): void
  destroy(): void
  getScore(): number
  getStatus(): GameStatus
}

export interface ControllerOptions {
  preview: boolean
  onScore: (score: number) => void
  onFinish: (score: number) => void
  onImpact: (kind: 'tap' | 'score' | 'perfect' | 'fail') => void
}

export interface MiniGameModule {
  id: string
  slug: string
  title: string
  kicker: string
  shortDescription: string
  fullDescription: string
  icon: string
  category: string
  objective: string
  theme: GameTheme
  controls: GameControlGuide[]
  scoringRules: ScoringRule[]
  failureConditions: string[]
  tips: string[]
  createController(options: ControllerOptions): GameController
}

export interface GameStats {
  gameId: string
  bestScore: number
  lastScore: number
  playCount: number
  totalPlayTime: number
  lastPlayedAt: number
  achievements: Record<string, number | boolean>
}
