import { describe, expect, it, vi } from 'vitest'
import { gameRegistry } from '../games/registry'
import type { GameController } from '../games/types'

type LoopController = GameController & {
  ball: { x: number; y: number; vx: number; vy: number; r: number; kick: number; collisionCooldown: number }
  target: { side: -1 | 1; x: number; y: number; pulse: number; netPunch: number }
  timeLeft: number
  cleanStreak: number
  rimHits: number
  touchedSurface: boolean
}

const makeController = () => {
  const game = gameRegistry.find((item) => item.id === 'loop-hoops')!
  const onScore = vi.fn(), onFinish = vi.fn()
  const controller = game.createController({ preview: false, onScore, onFinish, onImpact: vi.fn() }) as LoopController
  controller.resize(390, 844, 1); controller.restart()
  return { controller, onScore, onFinish }
}

describe('Loop Hoops physics', () => {
  it('uses the same immediate tap impulse as Hoop Flight', () => {
    const { controller } = makeController()
    const previousY = controller.ball.y
    controller.pointerDown(0, 0)

    expect(controller.ball.y).toBe(previousY - 8)
    expect(controller.ball.vy).toBe(-570)
    expect(controller.ball.kick).toBe(1)
  })

  it('bounces off the floor without ending the game', () => {
    const { controller, onFinish } = makeController()
    controller.ball.y = 844 - 74 - controller.ball.r + 3
    controller.ball.vy = 600
    controller.update(1 / 60)

    expect(controller.ball.vy).toBeLessThan(0)
    expect(controller.getStatus()).toBe('playing')
    expect(onFinish).not.toHaveBeenCalled()
  })

  it('ends only when the timer is depleted', () => {
    const { controller, onFinish } = makeController()
    controller.timeLeft = .0001
    controller.update(.03)

    expect(controller.getStatus()).toBe('finished')
    expect(onFinish).toHaveBeenCalledWith(0)
  })

  it('refills time and moves the hoop to the opposite side after scoring', () => {
    const { controller, onScore } = makeController()
    const previousSide = controller.target.side
    controller.timeLeft = .2
    controller.ball.x = controller.target.x; controller.ball.y = controller.target.y - 8; controller.ball.vx = 0; controller.ball.vy = 500
    controller.update(.03)

    expect(controller.target.side).toBe(-previousSide)
    expect(controller.timeLeft).toBe(1)
    expect(controller.getScore()).toBe(1)
    expect(onScore).toHaveBeenCalledWith(1)
  })

  it('enters fire mode after three consecutive clean shots', () => {
    const { controller } = makeController()
    for (let shot = 0; shot < 3; shot++) {
      controller.rimHits = 0; controller.touchedSurface = false
      controller.ball.x = controller.target.x; controller.ball.y = controller.target.y - 8; controller.ball.vx = 0; controller.ball.vy = 500
      controller.update(.03)
    }

    expect(controller.cleanStreak).toBe(3)
    expect(controller.getScore()).toBe(6)
  })

  it('reflects cleanly from the visible backboard face', () => {
    const { controller } = makeController()
    const size = Math.min(190, 390 * .49)
    const boardCenter = controller.target.x + controller.target.side * size * .29
    const innerFace = boardCenter - controller.target.side * size * .025
    controller.ball.x = innerFace + controller.ball.r + 4
    controller.ball.y = controller.target.y - 55
    controller.ball.vx = -320; controller.ball.vy = 0; controller.ball.collisionCooldown = 0

    controller.update(.03)

    expect(controller.ball.vx).toBeGreaterThan(0)
    expect(controller.ball.x).toBeGreaterThanOrEqual(innerFace + controller.ball.r)
    expect(Math.hypot(controller.ball.vx, controller.ball.vy)).toBeLessThanOrEqual(860)
  })

  it('catches high-speed rim impacts without unstable repeated acceleration', () => {
    const { controller } = makeController()
    controller.ball.x = controller.target.x + 36
    controller.ball.y = controller.target.y - 42
    controller.ball.vx = 0; controller.ball.vy = 900; controller.ball.collisionCooldown = 0

    controller.update(.03)

    expect(controller.rimHits).toBe(1)
    expect(controller.ball.vy).toBeLessThan(0)
    expect(Math.hypot(controller.ball.vx, controller.ball.vy)).toBeLessThanOrEqual(860)
    const velocityAfterHit = { x: controller.ball.vx, y: controller.ball.vy }
    controller.update(1 / 120)
    expect(controller.rimHits).toBe(1)
    expect(Math.hypot(controller.ball.vx, controller.ball.vy)).toBeLessThanOrEqual(Math.hypot(velocityAfterHit.x, velocityAfterHit.y) + 20)
  })

  it('blocks the ball from passing upward through the rim underside', () => {
    const { controller } = makeController()
    const undersideY = controller.target.y + 6
    controller.ball.x = controller.target.x
    controller.ball.y = undersideY + controller.ball.r + 5
    controller.ball.vx = 35; controller.ball.vy = -620; controller.ball.collisionCooldown = 0

    controller.update(.03)

    expect(controller.rimHits).toBe(1)
    expect(controller.ball.y).toBeGreaterThanOrEqual(undersideY + controller.ball.r)
    expect(controller.ball.vy).toBeGreaterThan(0)
    expect(Math.hypot(controller.ball.vx, controller.ball.vy)).toBeLessThanOrEqual(860)
  })
})
