import { describe, expect, it, vi } from 'vitest'
import { gameRegistry } from '../games/registry'
import type { GameController } from '../games/types'

type LoopController = GameController & {
  ball: { x: number; y: number; vx: number; vy: number; r: number; kick: number; collisionCooldown: number }
  target: { side: -1 | 1; x: number; y: number; pulse: number; netPunch: number }
  timeLeft: number
  buzzerActive: boolean
  cleanStreak: number
  rimHits: number
  touchedSurface: boolean
  trail: Array<{ x: number; y: number; life: number }>
  wrapGraceSide: -1 | 1 | null
  wrapApproachSide: -1 | 1 | null
  scoreEffect: { x: number; y: number; life: number; label: string; points: number; clean: boolean; streak: number }
  getHoopConnectorGeometry: () => { start: { x: number; y: number }; end: { x: number; y: number }; radius: number }
  getHoopConnectorGeometries: () => Array<{ start: { x: number; y: number }; end: { x: number; y: number }; radius: number }>
  getGoalCrossing: (previous: { x: number; y: number }) => { grazedRim: boolean } | null
  wrappedRenderOffsets: (x: number, radius: number) => number[]
}

const makeController = () => {
  const game = gameRegistry.find((item) => item.id === 'loop-hoops')!
  const onScore = vi.fn(), onFinish = vi.fn()
  const controller = game.createController({ preview: false, onScore, onFinish, onImpact: vi.fn() }) as LoopController
  controller.resize(390, 844, 1); controller.restart()
  return { controller, onScore, onFinish }
}

describe('Loop Hoops physics', () => {
  it('uses the same tap impulse as Hoop Flight without teleporting', () => {
    const { controller } = makeController()
    const previousY = controller.ball.y
    controller.pointerDown(0, 0)

    expect(controller.ball.y).toBe(previousY)
    expect(controller.ball.vy).toBe(-570)
    expect(controller.ball.kick).toBe(1)
  })

  it('lets the ball rise freely until the visible timer becomes the ceiling', () => {
    const { controller } = makeController()
    controller.ball.y = 90; controller.ball.vy = -100
    controller.update(.01)

    expect(controller.ball.y).toBeLessThan(90)
    expect(controller.ball.vy).toBeLessThan(0)

    const timerBottom = 10 + 25
    controller.ball.y = timerBottom + controller.ball.r + 1
    controller.ball.vy = -500
    controller.update(.01)

    expect(controller.ball.y).toBeGreaterThanOrEqual(timerBottom + controller.ball.r)
    expect(controller.ball.y).toBeLessThan(timerBottom + controller.ball.r + 3)
    expect(controller.ball.vy).toBeGreaterThan(0)
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

  it('wraps through both open side edges without bouncing', () => {
    const { controller } = makeController()
    controller.target.side = 1; controller.target.x = 390 - 82
    controller.ball.x = .5; controller.ball.y = 600
    controller.ball.vx = -120; controller.ball.vy = 0; controller.touchedSurface = false

    controller.update(.01)

    expect(controller.ball.x).toBeCloseTo(389.3, 5)
    expect(controller.ball.vx).toBe(-120)
    expect(controller.touchedSurface).toBe(false)
    expect(controller.trail[0].x).toBeCloseTo(controller.ball.x, 5)

    controller.target.side = -1; controller.target.x = 82
    controller.ball.x = 389.5; controller.ball.y = 600
    controller.ball.vx = 120; controller.ball.vy = 0; controller.touchedSurface = false

    controller.update(.01)

    expect(controller.ball.x).toBeCloseTo(.7, 5)
    expect(controller.ball.vx).toBe(120)
    expect(controller.touchedSurface).toBe(false)
  })

  it('renders a matching ball copy while crossing either side boundary', () => {
    const { controller } = makeController()

    expect(controller.wrappedRenderOffsets(3, controller.ball.r)).toEqual([0, 390])
    expect(controller.wrappedRenderOffsets(387, controller.ball.r)).toEqual([0, -390])
    expect(controller.wrappedRenderOffsets(195, controller.ball.r)).toEqual([0])
  })

  it.each([-1, 1] as const)('preserves the vertical path while emerging beside the %s backboard', (side) => {
    const { controller } = makeController()
    const size = Math.min(190, 390 * .49)
    controller.target.side = side
    controller.target.x = side === -1 ? size * (.29 + .025) : 390 - size * (.29 + .025)
    controller.target.y = 330
    controller.ball.x = side === -1 ? 389.5 : .5
    controller.ball.y = controller.target.y - size * .48 - 8
    controller.ball.vx = side === -1 ? 160 : -160
    controller.ball.vy = 0
    const startingY = controller.ball.y

    controller.update(.04)

    expect(controller.wrapGraceSide).toBe(side)
    expect(controller.ball.y).toBeGreaterThan(startingY)
    expect(controller.ball.vy).toBeGreaterThan(0)
    expect(controller.ball.vx).toBe(side === -1 ? 160 : -160)
  })

  it.each([
    [-1, 1 / 30], [-1, 1 / 60], [-1, 1 / 120],
    [1, 1 / 30], [1, 1 / 60], [1, 1 / 120],
  ] as const)('does not create a tap-like bounce before crossing side %s at %s second frames', (side, frameTime) => {
    const { controller } = makeController()
    controller.target.side = side
    controller.target.x = side === -1 ? Math.min(190, 390 * .49) * (.29 + .025) : 390 - Math.min(190, 390 * .49) * (.29 + .025)
    const activeConnector = controller.getHoopConnectorGeometry()
    const center = {
      x: (activeConnector.start.x + activeConnector.end.x) * .5,
      y: (activeConnector.start.y + activeConnector.end.y) * .5,
    }
    const segmentX = activeConnector.end.x - activeConnector.start.x
    const segmentY = activeConnector.end.y - activeConnector.start.y
    const segmentLength = Math.hypot(segmentX, segmentY)
    const courtNormal = { x: -side * segmentY / segmentLength, y: side * segmentX / segmentLength }
    const clearance = controller.ball.r + activeConnector.radius + .5
    controller.ball.x = center.x + courtNormal.x * clearance
    controller.ball.y = center.y + courtNormal.y * clearance
    controller.ball.vx = side * 160
    controller.ball.vy = 0
    controller.touchedSurface = false
    const startingY = controller.ball.y

    controller.update(frameTime)

    expect(controller.wrapApproachSide).toBe(side)
    expect(controller.wrapGraceSide).toBeNull()
    expect(controller.ball.vx).toBe(side * 160)
    expect(controller.ball.vy).toBeGreaterThan(0)
    expect(controller.ball.y).toBeGreaterThan(startingY)
    expect(controller.touchedSurface).toBe(false)
  })

  it('starts the buzzer at zero, blocks new taps, and ends only when the ball reaches the floor', () => {
    const { controller, onFinish } = makeController()
    controller.timeLeft = .0001; controller.ball.y = 300; controller.ball.vy = -240
    controller.update(.03)

    expect(controller.buzzerActive).toBe(true)
    expect(controller.timeLeft).toBe(0)
    expect(controller.getStatus()).toBe('playing')
    expect(onFinish).not.toHaveBeenCalled()

    const velocityAfterBuzzer = { vx: controller.ball.vx, vy: controller.ball.vy }
    controller.pointerDown(0, 0)
    expect(controller.ball.vx).toBe(velocityAfterBuzzer.vx)
    expect(controller.ball.vy).toBe(velocityAfterBuzzer.vy)

    controller.ball.y = 844 - 74 - controller.ball.r + 2; controller.ball.vy = 600
    controller.update(.01)
    expect(controller.getStatus()).toBe('finished')
    expect(onFinish).toHaveBeenCalledWith(0)
  })

  it('refills the timer after a buzzer beater and immediately continues play', () => {
    const { controller, onScore, onFinish } = makeController()
    const previousSide = controller.target.side
    controller.timeLeft = .0001
    controller.ball.x = controller.target.x; controller.ball.y = controller.target.y - 8
    controller.ball.vx = 0; controller.ball.vy = 500
    controller.update(.03)

    expect(controller.buzzerActive).toBe(false)
    expect(controller.getStatus()).toBe('playing')
    expect(controller.getScore()).toBe(1)
    expect(controller.timeLeft).toBe(1)
    expect(controller.target.side).toBe(-previousSide)
    expect(controller.scoreEffect.label).toBe('BUZZER BEATER!  +1')
    expect(onScore).toHaveBeenCalledWith(1)
    expect(onFinish).not.toHaveBeenCalled()

    controller.pointerDown(0, 0)
    expect(controller.ball.vy).toBe(-570)
    controller.ball.y = 844 - 74 - controller.ball.r + 2; controller.ball.vy = 600
    controller.update(.01)
    expect(controller.getStatus()).toBe('playing')
    expect(controller.ball.vy).toBeLessThan(0)
    expect(onFinish).not.toHaveBeenCalled()
  })

  it('refills time and moves the hoop to the opposite side after scoring', () => {
    const { controller, onScore } = makeController()
    const previousSide = controller.target.side, scoredAt = { x: controller.target.x, y: controller.target.y }
    controller.timeLeft = .2
    controller.ball.x = controller.target.x; controller.ball.y = controller.target.y - 8; controller.ball.vx = 0; controller.ball.vy = 500
    controller.update(.03)

    expect(controller.target.side).toBe(-previousSide)
    expect(controller.timeLeft).toBe(1)
    expect(controller.getScore()).toBe(1)
    expect(onScore).toHaveBeenCalledWith(1)
    expect(controller.scoreEffect).toMatchObject({ x: scoredAt.x, y: scoredAt.y, life: 1, clean: true, label: 'CLEAN!  +1' })
  })

  it('rejects a crossing through the backboard-to-rim gap', () => {
    const { controller, onScore } = makeController()
    const previousSide = controller.target.side
    const connector = controller.getHoopConnectorGeometries().find((item) => item.start.y === item.end.y)!
    controller.ball.x = (connector.start.x + connector.end.x) * .5
    controller.ball.y = connector.start.y - 8
    controller.ball.vx = 0; controller.ball.vy = 500; controller.ball.collisionCooldown = 1

    controller.update(.03)

    expect(controller.getScore()).toBe(0)
    expect(controller.target.side).toBe(previousSide)
    expect(onScore).not.toHaveBeenCalled()
  })

  it('counts a visible inside-edge basket without calling it a clean shot', () => {
    const { controller, onScore } = makeController()
    const previousSide = controller.target.side
    controller.ball.x = controller.target.x + 16
    controller.ball.y = controller.target.y - 8
    controller.ball.vx = 0; controller.ball.vy = 500
    controller.rimHits = 0; controller.touchedSurface = false

    controller.update(.03)

    expect(controller.getScore()).toBe(1)
    expect(controller.target.side).toBe(-previousSide)
    expect(controller.scoreEffect).toMatchObject({ clean: false, points: 1, label: 'SCORE!  +1' })
    expect(onScore).toHaveBeenCalledWith(1)
  })

  it('keeps the forgiving goal sensor inside the visible rim', () => {
    const { controller } = makeController()
    controller.ball.x = controller.target.x + 18
    controller.ball.y = controller.target.y + 1
    controller.ball.vx = 0; controller.ball.vy = 500

    expect(controller.getGoalCrossing({ x: controller.ball.x, y: controller.target.y - 1 })).toBeNull()
  })

  it('physically blocks the backboard-to-rim seam even during collision cooldown', () => {
    const { controller } = makeController()
    const connector = controller.getHoopConnectorGeometry()
    const center = { x: (connector.start.x + connector.end.x) * .5, y: (connector.start.y + connector.end.y) * .5 }
    const dx = connector.end.x - connector.start.x, dy = connector.end.y - connector.start.y
    const length = Math.hypot(dx, dy), normal = { x: dy / length, y: -dx / length }
    const clearance = controller.ball.r + connector.radius + 4
    controller.ball.x = center.x + normal.x * clearance; controller.ball.y = center.y + normal.y * clearance
    controller.ball.vx = -normal.x * 600; controller.ball.vy = -normal.y * 600
    controller.ball.collisionCooldown = 1; controller.touchedSurface = false

    controller.update(.03)

    const sideDistance = (controller.ball.x - center.x) * normal.x + (controller.ball.y - center.y) * normal.y
    expect(sideDistance).toBeGreaterThan(0)
    expect(controller.ball.vx * normal.x + controller.ball.vy * normal.y).toBeGreaterThan(-200)
    expect(controller.touchedSurface).toBe(true)
    expect(controller.getScore()).toBe(0)
  })

  it.each([1 / 30, 1 / 60, 1 / 120])('blocks the horizontal backboard seam at %s second frames', (frameTime) => {
    const { controller } = makeController()
    const connector = controller.getHoopConnectorGeometries().find((item) => item.start.y === item.end.y)!
    const centerX = (connector.start.x + connector.end.x) * .5
    controller.ball.x = centerX
    controller.ball.y = connector.start.y - controller.ball.r - connector.radius - 5
    controller.ball.vx = 0
    controller.ball.vy = 900
    controller.ball.collisionCooldown = 1

    controller.update(frameTime)

    expect(controller.getScore()).toBe(0)
    expect(controller.ball.y).toBeLessThan(connector.start.y)
    expect(controller.touchedSurface).toBe(true)
  })

  it('cannot tunnel through any point of either connector at maximum speed', () => {
    for (const connectorIndex of [0, 1]) {
      for (const position of [.15, .35, .5, .65, .85]) {
        const { controller } = makeController()
        const connector = controller.getHoopConnectorGeometries()[connectorIndex]
        const dx = connector.end.x - connector.start.x, dy = connector.end.y - connector.start.y
        const length = Math.hypot(dx, dy), normal = { x: dy / length, y: -dx / length }
        const center = { x: connector.start.x + dx * position, y: connector.start.y + dy * position }
        const clearance = controller.ball.r + connector.radius + 5
        controller.ball.x = center.x + normal.x * clearance
        controller.ball.y = center.y + normal.y * clearance
        controller.ball.vx = -normal.x * 860
        controller.ball.vy = -normal.y * 860
        controller.ball.collisionCooldown = 1

        controller.update(1 / 30)

        const sideDistance = (controller.ball.x - center.x) * normal.x + (controller.ball.y - center.y) * normal.y
        expect(sideDistance).toBeGreaterThan(0)
        expect(controller.getScore()).toBe(0)
      }
    }
  })

  it('drains the refilled timer progressively faster as the score rises', () => {
    const { controller: fresh } = makeController()
    fresh.ball.x = 195; fresh.ball.y = 620; fresh.ball.vx = 0; fresh.ball.vy = 0
    fresh.update(.03)
    const earlyDrain = 1 - fresh.timeLeft

    const { controller } = makeController()
    for (let shot = 0; shot < 6; shot++) {
      controller.rimHits = 0; controller.touchedSurface = true
      controller.ball.x = controller.target.x; controller.ball.y = controller.target.y - 8
      controller.ball.vx = 0; controller.ball.vy = 500
      controller.update(.03)
    }
    expect(controller.timeLeft).toBe(1)
    controller.ball.x = 195; controller.ball.y = 620; controller.ball.vx = 0; controller.ball.vy = 0
    controller.update(.03)
    const lateDrain = 1 - controller.timeLeft

    expect(controller.getScore()).toBe(6)
    expect(lateDrain).toBeGreaterThan(earlyDrain * 1.55)
  })

  it('enters fire mode and escalates points on consecutive clean shots', () => {
    const { controller } = makeController()
    for (let shot = 0; shot < 3; shot++) {
      controller.rimHits = 0; controller.touchedSurface = false
      controller.ball.x = controller.target.x; controller.ball.y = controller.target.y - 8; controller.ball.vx = 0; controller.ball.vy = 500
      controller.update(.03)
    }

    expect(controller.cleanStreak).toBe(3)
    expect(controller.getScore()).toBe(6)
    expect(controller.scoreEffect).toMatchObject({ clean: true, streak: 3, points: 3, label: 'FIRE ×3  +3' })
  })

  it('reflects cleanly from the visible backboard face', () => {
    const { controller } = makeController()
    const size = Math.min(190, 390 * .49)
    const boardCenter = controller.target.x + controller.target.side * size * .29
    const outerEdge = boardCenter + controller.target.side * size * .025
    const innerFace = boardCenter - controller.target.side * size * .025
    expect(outerEdge).toBeCloseTo(0)
    controller.ball.x = innerFace + controller.ball.r + 4
    controller.ball.y = controller.target.y - 55
    controller.ball.vx = -320; controller.ball.vy = 0; controller.ball.collisionCooldown = 0

    controller.update(.03)

    expect(controller.ball.vx).toBeGreaterThan(0)
    expect(controller.ball.x).toBeGreaterThanOrEqual(innerFace + controller.ball.r)
    expect(Math.hypot(controller.ball.vx, controller.ball.vy)).toBeLessThanOrEqual(860)
  })

  it.each([-1, 1] as const)('keeps the visible backboard solid at normal travel speed on side %s', (side) => {
    const { controller } = makeController()
    const size = Math.min(190, 390 * .49)
    controller.target.side = side
    controller.target.x = side === -1 ? size * (.29 + .025) : 390 - size * (.29 + .025)
    const boardCenter = controller.target.x + side * size * .29
    const innerFace = boardCenter - side * size * .025
    controller.ball.x = innerFace - side * (controller.ball.r + 4)
    controller.ball.y = controller.target.y - 55
    controller.ball.vx = side * 160
    controller.ball.vy = 120
    controller.touchedSurface = false
    const expectedVerticalVelocity = controller.ball.vy + 1850 * .03

    controller.update(.03)

    expect(controller.ball.vx * side).toBeLessThan(0)
    expect(controller.ball.vy).toBeCloseTo(expectedVerticalVelocity, 5)
    expect(side === -1 ? controller.ball.x >= innerFace + controller.ball.r : controller.ball.x <= innerFace - controller.ball.r).toBe(true)
    expect(controller.touchedSurface).toBe(true)
  })

  it.each([-1, 1] as const)('wraps without an impact when the ball clears the visible backboard on side %s', (side) => {
    const { controller } = makeController()
    const size = Math.min(190, 390 * .49)
    controller.target.side = side
    controller.target.x = side === -1 ? size * (.29 + .025) : 390 - size * (.29 + .025)
    const boardTop = controller.target.y - size * .48
    controller.ball.x = side === -1 ? .5 : 389.5
    controller.ball.y = boardTop - controller.ball.r - 2
    controller.ball.vx = side * 160
    controller.ball.vy = 0
    controller.touchedSurface = false
    const startingY = controller.ball.y

    controller.update(.01)

    expect(side === -1 ? controller.ball.x > 380 : controller.ball.x < 10).toBe(true)
    expect(controller.ball.vx).toBe(side * 160)
    expect(controller.ball.vy).toBeGreaterThan(0)
    expect(controller.ball.y).toBeGreaterThan(startingY)
    expect(controller.touchedSurface).toBe(false)
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
