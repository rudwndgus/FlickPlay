import { describe, expect, it, vi } from 'vitest'
import { gameRegistry } from '../games/registry'
import type { GameController } from '../games/types'

type DunkController = GameController & {
  ball: { x: number; y: number; vx: number; vy: number; r: number; flying: boolean; collisionCooldown: number }
  launchHoop: { x: number; y: number; passed: boolean; netPunch?: number }
  targetHoop: { x: number; y: number; passed: boolean; netPunch?: number }
  dragStart: { x: number; y: number } | null
  dragPoint: { x: number; y: number } | null
  transitionDelay: number
  rescueDelay: number
  climbRemaining: number
  wallBounces: number
  rimHits: number
  cleanStreak: number
  scoreLabel: string
  lastShotPoints: number
  launchRimArmed: boolean
  shotPower: number
  getAimTrajectory: () => Array<{ x: number; y: number }>
  getRimGeometry: (hoop: DunkController['targetHoop']) => { left: { x: number; y: number }; right: { x: number; y: number }; tubeRadius: number }
  collideWithRims: (hoop: DunkController['targetHoop']) => void
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
    expect(controller.shotPower).toBe(6.8)
    expect(controller.ball.vx).toBeCloseTo(-30 * controller.shotPower, 5)
    expect(controller.ball.vy).toBeCloseTo(-120 * controller.shotPower, 5)
    expect(controller.launchHoop.netPunch).toBe(1)
    expect(controller.launchRimArmed).toBe(false)
  })

  it('previews the reflected route after a side-wall bounce', () => {
    const { controller } = makeController()
    const start = { x: controller.ball.x, y: controller.ball.y }
    controller.pointerDown(start.x, start.y)
    controller.pointerMove(start.x + 140, start.y + 20)

    const trajectory = controller.getAimTrajectory()
    const xs = trajectory.map((point) => point.x)
    const lowestIndex = xs.indexOf(Math.min(...xs))

    expect(trajectory).toHaveLength(108)
    expect(xs.every((x) => x >= controller.ball.r && x <= 390 - controller.ball.r)).toBe(true)
    expect(xs[lowestIndex]).toBe(controller.ball.r)
    expect(lowestIndex).toBeGreaterThan(0)
    expect(lowestIndex).toBeLessThan(xs.length - 1)
    expect(xs.at(-1)).toBeGreaterThan(xs[lowestIndex])
  })

  it('ignores the launch rim while the fired ball is exiting upward', () => {
    const { controller } = makeController()
    const rim = controller.getRimGeometry(controller.launchHoop)
    controller.launchRimArmed = false
    controller.ball.x = rim.left.x; controller.ball.y = rim.left.y + controller.ball.r + 1
    controller.ball.vx = 0; controller.ball.vy = -300; controller.ball.flying = true; controller.ball.collisionCooldown = 0

    controller.update(.01)

    expect(controller.ball.vy).toBeLessThan(0)
    expect(controller.launchRimArmed).toBe(false)
  })

  it('restores launch-rim collisions when the ball falls back down', () => {
    const { controller } = makeController()
    const rim = controller.getRimGeometry(controller.launchHoop)
    controller.launchRimArmed = true
    controller.ball.x = rim.left.x; controller.ball.y = rim.left.y - controller.ball.r - 1
    controller.ball.vx = 0; controller.ball.vy = 300; controller.ball.flying = true; controller.ball.collisionCooldown = 0

    controller.update(.01)

    expect(controller.ball.vy).toBeLessThan(0)
  })

  it('limits the elastic pull distance', () => {
    const { controller } = makeController()
    controller.pointerDown(controller.ball.x, controller.ball.y)
    controller.pointerMove(controller.ball.x + 500, controller.ball.y + 500)

    const anchorY = controller.launchHoop.y - 14
    expect(Math.hypot(controller.ball.x - controller.launchHoop.x, controller.ball.y - anchorY)).toBeCloseTo(150, 4)
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

    expect(controller.getScore()).toBe(2)
  })

  it('scores a descending shot and starts the climb transition', () => {
    const { controller, onScore } = makeController()
    controller.ball.x = controller.targetHoop.x
    controller.ball.y = controller.targetHoop.y - 7
    controller.ball.vx = 0; controller.ball.vy = 500; controller.ball.flying = true

    controller.update(.03)

    expect(controller.getScore()).toBe(2)
    expect(controller.targetHoop.passed).toBe(true)
    expect(controller.targetHoop.netPunch).toBe(1)
    expect(controller.transitionDelay).toBeGreaterThan(0)
    expect(onScore).toHaveBeenCalledWith(2)
  })

  it('stacks wall and clean-shot bonuses', () => {
    const { controller, onScore } = makeController()
    controller.wallBounces = 1
    controller.rimHits = 0
    controller.ball.x = controller.targetHoop.x
    controller.ball.y = controller.targetHoop.y - 7
    controller.ball.vx = 0; controller.ball.vy = 500; controller.ball.flying = true

    controller.update(.03)

    expect(controller.getScore()).toBe(3)
    expect(controller.scoreLabel).toBe('WALL + CLEAN  +3')
    expect(onScore).toHaveBeenCalledWith(3)
  })

  it('awards a wall bonus after a rim contact without a clean bonus', () => {
    const { controller } = makeController()
    controller.wallBounces = 1
    controller.rimHits = 1
    controller.ball.x = controller.targetHoop.x
    controller.ball.y = controller.targetHoop.y - 7
    controller.ball.vx = 0; controller.ball.vy = 500; controller.ball.flying = true

    controller.update(.03)

    expect(controller.getScore()).toBe(2)
    expect(controller.scoreLabel).toBe('BANK SHOT  +2')
  })

  it('ignites and escalates points after consecutive clean shots', () => {
    const { controller } = makeController()
    for (let shot = 0; shot < 3; shot++) {
      controller.targetHoop.passed = false; controller.transitionDelay = 0
      controller.rimHits = 0; controller.wallBounces = 0
      controller.ball.x = controller.targetHoop.x; controller.ball.y = controller.targetHoop.y - 7
      controller.ball.vx = 0; controller.ball.vy = 500; controller.ball.flying = true
      controller.update(.03)
    }

    expect(controller.cleanStreak).toBe(3)
    expect(controller.lastShotPoints).toBe(4)
    expect(controller.getScore()).toBe(9)
    expect(controller.scoreLabel).toBe('FIRE ×3  +4')
  })

  it('matches rim collisions to the visible sprite endpoints and thickness', () => {
    const { controller } = makeController()
    const rim = controller.getRimGeometry(controller.targetHoop)
    const rimSpan = Math.hypot(rim.right.x - rim.left.x, rim.right.y - rim.left.y)
    expect(rimSpan).toBeCloseTo(112 * Math.hypot(.6, .13), 4)
    expect(rim.tubeRadius).toBeCloseTo(112 * .027, 4)

    controller.ball.x = rim.left.x - controller.ball.r - rim.tubeRadius - 1
    controller.ball.y = rim.left.y
    controller.ball.vx = 300; controller.ball.vy = 0; controller.ball.collisionCooldown = 0
    controller.collideWithRims(controller.targetHoop)
    expect(controller.ball.vx).toBe(300)

    controller.ball.x += 2
    controller.collideWithRims(controller.targetHoop)
    expect(controller.ball.vx).toBeLessThan(0)
  })

  it('saves a missed shot that falls back through the launch hoop', () => {
    const { controller, onScore, onFinish } = makeController()
    controller.launchRimArmed = true
    controller.ball.x = controller.launchHoop.x
    controller.ball.y = controller.launchHoop.y - 8
    controller.ball.vx = 0; controller.ball.vy = 480; controller.ball.flying = true

    controller.update(.03)

    expect(controller.rescueDelay).toBeGreaterThan(0)
    expect(controller.getStatus()).toBe('playing')
    expect(controller.getScore()).toBe(0)
    expect(onScore).not.toHaveBeenCalled()
    expect(onFinish).not.toHaveBeenCalled()

    for (let frame = 0; frame < 40 && controller.rescueDelay > 0; frame++) controller.update(1 / 60)
    expect(controller.ball.flying).toBe(false)
    expect(controller.ball.x).toBe(controller.launchHoop.x)
    expect(controller.ball.y).toBe(controller.launchHoop.y - 14)
  })
})
