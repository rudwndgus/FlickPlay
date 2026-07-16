import { describe, expect, it, vi } from 'vitest'
import { gameRegistry } from '../games/registry'
import type { GameController } from '../games/types'

type InternalHoopFlight = GameController & {
  ball: { x: number; y: number; vx: number; vy: number; r: number; collisionCooldown: number }
  hoops: Array<{ x: number; y: number; passed: boolean; pulse: number; netPunch?: number }>
  speed: number
  cleanStreak: number
  scoreEffects: Array<{ label: string; streak: number }>
  captureTime: number
}

const makeController = () => {
  const game = gameRegistry.find((item) => item.id === 'hoop-flight')!
  const onScore = vi.fn()
  const onFinish = vi.fn()
  const controller = game.createController({ preview: false, onScore, onFinish, onImpact: vi.fn() }) as InternalHoopFlight
  controller.resize(500, 844, 1)
  controller.restart()
  return { controller, onScore, onFinish }
}

describe('Hoop Flight physics', () => {
  it('pushes the ball backward when it strikes the rim', () => {
    const { controller } = makeController()
    const hoop = { x: 275, y: 370, passed: false, pulse: 0, netPunch: 0 }
    const rimHalf = 128 * .36
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
    const hoop = { x: 275, y: 370, passed: false, pulse: 0, netPunch: 0 }
    controller.hoops = [hoop]
    controller.ball.x = hoop.x
    controller.ball.y = hoop.y - 10
    controller.ball.vx = 0
    controller.ball.vy = 700

    controller.update(.03)

    expect(controller.getScore()).toBe(1)
    expect(onScore).toHaveBeenCalledWith(1)
    expect(hoop.passed).toBe(true)
    expect(hoop.netPunch).toBe(1)
    expect(controller.captureTime).toBeGreaterThan(0)
  })

  it('does not miss a score when the ball crosses the rim over several 120Hz frames', () => {
    const { controller } = makeController()
    const hoop = { x: 275, y: 370, passed: false, pulse: 0, netPunch: 0 }
    controller.hoops = [hoop]
    controller.ball.x = hoop.x
    controller.ball.y = hoop.y - 12
    controller.ball.vx = 0
    controller.ball.vy = 80

    for (let frame = 0; frame < 20 && controller.getScore() === 0; frame++) controller.update(1 / 120)

    expect(controller.getScore()).toBe(1)
    expect(hoop.passed).toBe(true)
  })

  it('escalates consecutive clean shots into combo effects', () => {
    const { controller } = makeController()
    for (let shot = 0; shot < 3; shot++) {
      const hoop = { x: 275, y: 370, passed: false, pulse: 0 }
      controller.hoops = [hoop]
      controller.ball.x = hoop.x
      controller.ball.y = hoop.y - 10
      controller.ball.vx = 0
      controller.ball.vy = 700
      controller.update(.03)
    }

    expect(controller.cleanStreak).toBe(3)
    expect(controller.getScore()).toBe(6)
    expect(controller.scoreEffects.at(-1)?.label).toBe('FIRE ×3')
  })

  it('ends the run as soon as an unscored hoop passes behind the ball', () => {
    const { controller, onFinish } = makeController()
    controller.hoops = [{ x: controller.ball.x - 70, y: controller.ball.y - 150, passed: false, pulse: 0 }]

    controller.update(1 / 60)

    expect(controller.getStatus()).toBe('finished')
    expect(onFinish).toHaveBeenCalledWith(0)
  })

  it('ends the run when the ball is completely pushed past the left edge', () => {
    const { controller, onFinish } = makeController()
    controller.hoops = [{ x: 420, y: 300, passed: false, pulse: 0 }]
    controller.ball.x = -controller.ball.r - 2
    controller.ball.vx = -200

    controller.update(1 / 60)

    expect(controller.getStatus()).toBe('finished')
    expect(onFinish).toHaveBeenCalledWith(0)
  })
})
