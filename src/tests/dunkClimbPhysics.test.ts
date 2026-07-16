import { describe, expect, it, vi } from 'vitest'
import { gameRegistry } from '../games/registry'
import type { GameController } from '../games/types'

type DunkController = GameController & {
  ball: { x: number; y: number; vx: number; vy: number; flying: boolean }
  launchHoop: { x: number; y: number; netPunch?: number }
  targetHoop: { x: number; y: number; passed: boolean; netPunch?: number }
  dragStart: { x: number; y: number } | null
  dragPoint: { x: number; y: number } | null
  transitionDelay: number
  climbRemaining: number
}

const makeController = () => {
  const game = gameRegistry.find((item) => item.id === 'dunk-climb')!
  const onScore = vi.fn(), onFinish = vi.fn()
  const controller = game.createController({ preview: false, onScore, onFinish, onImpact: vi.fn() }) as DunkController
  controller.resize(390, 844, 1); controller.restart()
  return { controller, onScore, onFinish }
}

describe('Dunk Climb physics', () => {
  it('moves the ball with the drag and launches opposite the pull', () => {
    const { controller } = makeController()
    const start = { x: controller.ball.x, y: controller.ball.y }
    controller.pointerDown(start.x, start.y)
    controller.pointerMove(start.x + 30, start.y + 120)

    expect(controller.ball.x).toBeGreaterThan(start.x)
    expect(controller.ball.y).toBeGreaterThan(start.y)
    expect(controller.dragPoint).not.toBeNull()

    controller.pointerUp(start.x + 30, start.y + 120)
    expect(controller.ball.flying).toBe(true)
    expect(controller.ball.vx).toBeLessThan(0)
    expect(controller.ball.vy).toBeLessThan(0)
    expect(controller.launchHoop.netPunch).toBe(1)
  })

  it('limits the elastic pull distance', () => {
    const { controller } = makeController()
    controller.pointerDown(controller.ball.x, controller.ball.y)
    controller.pointerMove(controller.ball.x + 500, controller.ball.y + 500)

    const anchorY = controller.launchHoop.y - 14
    expect(Math.hypot(controller.ball.x - controller.launchHoop.x, controller.ball.y - anchorY)).toBeCloseTo(132, 4)
  })

  it('keeps the next hoop within the maximum shot arc', () => {
    const { controller } = makeController()
    const gap = controller.launchHoop.y - controller.targetHoop.y

    expect(gap).toBeCloseTo(844 * .27, 4)
    expect(gap).toBeLessThan(240)
  })

  it('can reach and score on the lowered target hoop', () => {
    const { controller } = makeController()
    controller.targetHoop.x = controller.launchHoop.x
    controller.autopilot?.(0)

    for (let frame = 0; frame < 180 && controller.getScore() === 0; frame++) controller.update(1 / 120)

    expect(controller.getScore()).toBe(1)
  })

  it('scores a descending shot and starts the climb transition', () => {
    const { controller, onScore } = makeController()
    controller.ball.x = controller.targetHoop.x
    controller.ball.y = controller.targetHoop.y - 7
    controller.ball.vx = 0; controller.ball.vy = 500; controller.ball.flying = true

    controller.update(.03)

    expect(controller.getScore()).toBe(1)
    expect(controller.targetHoop.passed).toBe(true)
    expect(controller.targetHoop.netPunch).toBe(1)
    expect(controller.transitionDelay).toBeGreaterThan(0)
    expect(onScore).toHaveBeenCalledWith(1)
  })
})
