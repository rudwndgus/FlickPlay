import { describe, expect, it, vi } from 'vitest'
import { gameRegistry } from '../games/registry'
import { formatGameScore, isBetterGameScore, selectBestGameScore } from '../games/scoring'
import type { GameController } from '../games/types'

type GolfController = GameController & {
  ball: { x: number; y: number; vx: number; vy: number; r: number }
  hole: { x: number; y: number; r: number }
  walls: Array<{ x: number; y: number; width: number; height: number }>
  waters: Array<{ x: number; y: number; rx: number; ry: number }>
  shotOrigin: { x: number; y: number }
  stageIndex: number
  stageStrokes: number
  totalStrokes: number
  completeTimer: number
  autoWaypoint: number
  loadStage: (index: number) => void
  collideGolfWall: (wall: { x: number; y: number; width: number; height: number }) => void
}

const makeController = () => {
  const game = gameRegistry.find((item) => item.id === 'pocket-golf')!
  const onScore = vi.fn(), onFinish = vi.fn()
  const controller = game.createController({ preview: false, onScore, onFinish, onImpact: vi.fn() }) as GolfController
  controller.resize(390, 844, 1); controller.restart()
  return { game, controller, onScore, onFinish }
}

describe('Pocket Golf', () => {
  it('treats fewer strokes as the better formatted record', () => {
    const { game } = makeController()
    expect(game.scoreDirection).toBe('low')
    expect(formatGameScore(game, 12)).toBe('12타')
    expect(isBetterGameScore(game, 11, 14)).toBe(true)
    expect(isBetterGameScore(game, 15, 14)).toBe(false)
    expect(selectBestGameScore(game, 14, 11)).toBe(11)
  })

  it('counts only a deliberate pull as a stroke', () => {
    const { controller, onScore } = makeController()
    controller.pointerDown(controller.ball.x, controller.ball.y)
    controller.pointerUp(controller.ball.x - 5, controller.ball.y)
    expect(controller.totalStrokes).toBe(0)

    controller.pointerDown(controller.ball.x, controller.ball.y)
    controller.pointerUp(controller.ball.x - 70, controller.ball.y)
    expect(controller.totalStrokes).toBe(1)
    expect(controller.getScore()).toBe(1)
    expect(onScore).toHaveBeenLastCalledWith(1)
  })

  it('uses visible wall bounds for a predictable bank shot', () => {
    const { controller } = makeController()
    const wall = controller.walls[0]
    controller.ball.x = wall.x + wall.width * .5
    controller.ball.y = wall.y + wall.height + controller.ball.r - 1
    controller.ball.vx = 0; controller.ball.vy = -300

    controller.collideGolfWall(wall)

    expect(controller.ball.y).toBeGreaterThanOrEqual(wall.y + wall.height + controller.ball.r)
    expect(controller.ball.vy).toBeGreaterThan(0)
  })

  it('returns to the previous lie and adds one penalty stroke in water', () => {
    const { controller, onScore } = makeController()
    controller.loadStage(1)
    const water = controller.waters[0]
    controller.stageStrokes = 1; controller.totalStrokes = 1
    controller.shotOrigin = { x: controller.ball.x, y: controller.ball.y }
    controller.ball.x = water.x; controller.ball.y = water.y; controller.ball.vx = 120; controller.ball.vy = 0

    controller.update(1 / 60)

    expect(controller.totalStrokes).toBe(2)
    expect(controller.stageStrokes).toBe(2)
    expect(controller.ball).toMatchObject({ x: controller.shotOrigin.x, y: controller.shotOrigin.y, vx: 0, vy: 0 })
    expect(onScore).toHaveBeenLastCalledWith(2)
  })

  it('advances through five holes and finishes with the total stroke count', () => {
    const { controller, onFinish } = makeController()
    for (let stage = 0; stage < 5; stage++) {
      controller.stageStrokes = 2
      controller.totalStrokes += 2
      controller.ball.x = controller.hole.x; controller.ball.y = controller.hole.y; controller.ball.vx = 0; controller.ball.vy = 0
      controller.update(1 / 60)
      expect(controller.completeTimer).toBeGreaterThan(0)
      for (let frame = 0; frame < 34; frame++) controller.update(1 / 30)
      if (stage < 4) expect(controller.stageIndex).toBe(stage + 1)
    }

    expect(controller.getStatus()).toBe('finished')
    expect(onFinish).toHaveBeenCalledWith(10)
  })

  it('provides a traversable route through every obstacle layout', () => {
    const { controller, onFinish } = makeController()
    for (let frame = 0; frame < 60 * 150 && controller.getStatus() !== 'finished'; frame++) {
      controller.autopilot?.(frame / 60)
      controller.update(1 / 60)
    }

    expect(controller.getStatus(), JSON.stringify({ stage: controller.stageIndex, waypoint: controller.autoWaypoint, ball: controller.ball, strokes: controller.totalStrokes })).toBe('finished')
    expect(controller.stageIndex).toBe(4)
    expect(onFinish).toHaveBeenCalledOnce()
    expect(onFinish.mock.calls[0][0]).toBeGreaterThanOrEqual(5)
    expect(onFinish.mock.calls[0][0]).toBeLessThan(40)
  })
})
