import { describe, expect, it, vi } from 'vitest'
import { gameRegistry } from '../games/registry'
import type { GameController } from '../games/types'

type InternalHoopFlight = GameController & {
  ball: { x: number; y: number; vx: number; vy: number; r: number; collisionCooldown: number }
  hoops: Array<{ x: number; y: number; passed: boolean; pulse: number }>
  speed: number
}

const makeController = () => {
  const game = gameRegistry.find((item) => item.id === 'hoop-flight')!
  const onScore = vi.fn()
  const controller = game.createController({ preview: false, onScore, onFinish: vi.fn(), onImpact: vi.fn() }) as InternalHoopFlight
  controller.resize(500, 844, 1)
  controller.restart()
  return { controller, onScore }
}

describe('Hoop Flight physics', () => {
  it('pushes the ball backward when it strikes the rim', () => {
    const { controller } = makeController()
    const hoop = { x: 275, y: 370, passed: false, pulse: 0 }
    const rimHalf = 194 * .33
    controller.hoops = [hoop]
    controller.ball.x = hoop.x - rimHalf - controller.ball.r + 3
    controller.ball.y = hoop.y
    controller.ball.vx = 0
    controller.ball.vy = 20

    controller.update(1 / 60)

    expect(controller.ball.vx).toBeLessThan(-150)
    expect(controller.ball.collisionCooldown).toBeGreaterThan(0)
  })

  it('scores only when the ball descends through the rim opening', () => {
    const { controller, onScore } = makeController()
    const hoop = { x: 275, y: 370, passed: false, pulse: 0 }
    controller.hoops = [hoop]
    controller.ball.x = hoop.x
    controller.ball.y = hoop.y - 10
    controller.ball.vx = 0
    controller.ball.vy = 700

    controller.update(.03)

    expect(controller.getScore()).toBe(1)
    expect(onScore).toHaveBeenCalledWith(1)
    expect(hoop.passed).toBe(true)
  })
})
