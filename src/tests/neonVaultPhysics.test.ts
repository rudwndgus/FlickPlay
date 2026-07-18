import { describe, expect, it, vi } from 'vitest'
import { gameRegistry } from '../games/registry'
import type { GameController } from '../games/types'
import { analyzeVaultReachability, NEON_VAULT_MAP, NEON_VAULT_STAGE_THREE_MAP, NEON_VAULT_STAGE_TWO_MAP } from '../games/runtime/NeonVaultController'

type VaultController = GameController & {
  player: { col: number; row: number; x: number; y: number; moving: boolean; shield: boolean }
  dots: Set<string>
  coins: Set<string>
  switches: Set<string>
  clearing: number
  dying: number
  elapsed: number
  shieldGrace: number
  enemy: { x: number; y: number; direction: number }
  stage: number
  buildPath: (dx: number, dy: number) => { x: number; y: number; teleport?: boolean; prism?: 'cw' | 'ccw' }[]
  visit: (node: { x: number; y: number }) => void
  danger: (x: number, y: number) => void
}

const makeController = () => {
  const game = gameRegistry.find((item) => item.id === 'neon-escape')!
  const onScore = vi.fn(), onFinish = vi.fn()
  const controller = game.createController({ preview: false, onScore, onFinish, onImpact: vi.fn() }) as VaultController
  controller.resize(390, 844, 1); controller.restart()
  return { controller, onScore, onFinish }
}

const enterStageTwo = (controller: VaultController) => {
  controller.dots.clear()
  controller.switches.clear()
  controller.visit({ x: 11, y: 1 })
  for (let i = 0; i < 24; i++) controller.update(.033)
  expect(controller.stage).toBe(2)
}

const enterStageThree = (controller: VaultController) => {
  enterStageTwo(controller)
  controller.dots.clear()
  controller.switches.clear()
  controller.visit({ x: 1, y: 1 })
  for (let i = 0; i < 24; i++) controller.update(.033)
  expect(controller.stage).toBe(3)
}

describe('Neon Vault movement', () => {
  it('uses a dense portrait maze with consistent row widths', () => {
    expect(NEON_VAULT_MAP).toHaveLength(19)
    expect(NEON_VAULT_MAP.every((row) => row.length === 13)).toBe(true)
    expect(NEON_VAULT_MAP.join('').split('0').length - 1).toBeGreaterThan(110)
    expect(NEON_VAULT_STAGE_TWO_MAP).toHaveLength(19)
    expect(NEON_VAULT_STAGE_TWO_MAP.every((row) => row.length === 13)).toBe(true)
    expect(NEON_VAULT_STAGE_TWO_MAP.join('').split('0').length - 1).toBeGreaterThan(110)
    expect(NEON_VAULT_STAGE_THREE_MAP).toHaveLength(19)
    expect(NEON_VAULT_STAGE_THREE_MAP.every((row) => row.length === 13)).toBe(true)
    expect(NEON_VAULT_STAGE_THREE_MAP.join('').split('0').length - 1).toBeGreaterThan(110)
  })

  it('makes every required signal reachable and always allows a route back to the exit', () => {
    const { controller } = makeController()
    const analysis = analyzeVaultReachability()
    expect(analysis.stops.has('11,1')).toBe(true)
    expect([...controller.dots].every((key) => analysis.cells.has(key))).toBe(true)
    expect([...controller.switches].every((key) => analysis.cells.has(key))).toBe(true)
    expect([...analysis.stops].every((key) => analysis.returnableStops.has(key))).toBe(true)
    expect([...analysis.stops].every((key) => analysis.exitReachableStops.has(key))).toBe(true)
  })

  it('slides to the tile immediately before a wall', () => {
    const { controller } = makeController()
    const path = controller.buildPath(0, -1)
    expect(path.at(-1)).toMatchObject({ x: 1, y: 9 })
  })

  it('checks and collects every signal crossed during a fast slide', () => {
    const { controller, onScore } = makeController()
    const crossedSignals = controller.buildPath(0, -1)
      .slice(1)
      .map(({ x, y }) => `${x},${y}`)
      .filter((key) => controller.dots.has(key))
    const crossedCoins = controller.buildPath(0, -1)
      .slice(1)
      .map(({ x, y }) => `${x},${y}`)
      .filter((key) => controller.coins.has(key))
    expect(crossedSignals.length).toBeGreaterThan(2)
    controller.swipe!(0, -70)
    for (let i = 0; i < 40; i++) controller.update(.02)
    expect(controller.player).toMatchObject({ col: 1, row: 9, moving: false })
    expect(crossedSignals.every((key) => !controller.dots.has(key))).toBe(true)
    expect(onScore).toHaveBeenLastCalledWith(crossedSignals.length + crossedCoins.length * 10)
  })

  it('ignores new directions until the current slide has stopped', () => {
    const { controller } = makeController()
    controller.swipe!(0, -70)
    const initialPath = controller.buildPath(0, -1)
    controller.swipe!(70, 0)
    expect(controller.player.moving).toBe(true)
    expect(initialPath.at(-1)).toMatchObject({ x: 1, y: 9 })
  })

  it('cancels touches shorter than the 24px swipe threshold', () => {
    const { controller } = makeController()
    controller.pointerDown(100, 100)
    controller.pointerUp(118, 102)
    expect(controller.player.moving).toBe(false)
  })

  it('consumes a shield and stops on the collision cell for a tactical redirect', () => {
    const { controller, onFinish } = makeController()
    controller.player.shield = true
    controller.swipe!(0, -70)
    controller.update(.033)
    controller.update(.033)
    expect(controller.player.moving).toBe(true)

    controller.danger(controller.player.x, controller.player.y)
    expect(controller.player).toMatchObject({ col: 1, row: 16, x: 1, y: 16, moving: false, shield: false })
    controller.danger(controller.player.x, controller.player.y)
    expect(controller.getStatus()).toBe('playing')
    expect(onFinish).not.toHaveBeenCalled()
    controller.swipe!(0, -70)
    expect(controller.player.moving).toBe(true)
  })

  it('kills a player waiting on a blinking laser when the line turns on', () => {
    const { controller } = makeController()
    controller.player = { col: 5, row: 11, x: 5, y: 11, moving: false, shield: false }
    controller.enemy = { x: 10.6, y: 11, direction: 1 }
    for (let i = 0; i < 8; i++) controller.update(.033)
    expect(controller.dying).toBe(0)
    for (let i = 0; i < 2; i++) controller.update(.033)
    expect(controller.dying).toBeGreaterThan(0)
  })

  it('checks active spikes and moving enemies even while the player is stationary', () => {
    for (const x of [5, 6]) {
      const spikeRun = makeController().controller
      spikeRun.enemy = { x: 10.6, y: 11, direction: 1 }
      spikeRun.player = { col: x, row: 9, x, y: 9, moving: false, shield: false }
      spikeRun.update(.001)
      expect(spikeRun.dying).toBeGreaterThan(0)
    }

    const enemyRun = makeController().controller
    enemyRun.player = { col: 4, row: 11, x: 4, y: 11, moving: false, shield: false }
    enemyRun.enemy = { x: 4.2, y: 11, direction: 1 }
    enemyRun.update(.001)
    expect(enemyRun.dying).toBeGreaterThan(0)
  })

  it('detects an active laser continuously while sliding across it', () => {
    const { controller } = makeController()
    controller.elapsed = .4
    controller.player = { col: 3, row: 11, x: 3, y: 11, moving: false, shield: false }
    controller.enemy = { x: 10.6, y: 11, direction: 1 }
    controller.swipe!(70, 0)
    controller.update(.033)
    controller.update(.033)
    expect(controller.dying).toBeGreaterThan(0)
  })

  it('uses shield grace once, then kills the player if they remain on an active laser', () => {
    const { controller } = makeController()
    controller.player = { col: 5, row: 11, x: 5, y: 11, moving: false, shield: true }
    controller.enemy = { x: 10.6, y: 11, direction: 1 }
    for (let i = 0; i < 10; i++) controller.update(.033)
    expect(controller.player.shield).toBe(false)
    expect(controller.shieldGrace).toBeGreaterThan(0)
    expect(controller.dying).toBe(0)
    for (let i = 0; i < 17; i++) controller.update(.033)
    expect(controller.dying).toBeGreaterThan(0)
  })

  it('applies continuous laser, spike, and enemy collision checks in the mint stage', () => {
    const laserRun = makeController().controller
    enterStageTwo(laserRun)
    laserRun.elapsed = 0
    laserRun.player = { col: 5, row: 17, x: 5, y: 17, moving: false, shield: false }
    for (let i = 0; i < 10; i++) laserRun.update(.033)
    expect(laserRun.dying).toBeGreaterThan(0)

    const spikeRun = makeController().controller
    enterStageTwo(spikeRun)
    spikeRun.elapsed = 0
    spikeRun.player = { col: 9, row: 9, x: 9, y: 9, moving: false, shield: false }
    spikeRun.update(.001)
    expect(spikeRun.dying).toBeGreaterThan(0)

    const enemyRun = makeController().controller
    enterStageTwo(enemyRun)
    enemyRun.player = { col: 7, row: 7, x: 7, y: 7, moving: false, shield: false }
    enemyRun.enemy = { x: 7, y: 7, direction: 1 }
    enemyRun.update(.001)
    expect(enemyRun.dying).toBeGreaterThan(0)
  })

  it('teleports through a portal and keeps the original direction', () => {
    const { controller } = makeController()
    controller.player = { col: 5, row: 17, x: 5, y: 17, moving: false, shield: false }
    const path = controller.buildPath(1, 0)
    expect(path.some((node) => node.teleport && node.x === 1 && node.y === 1)).toBe(true)
    expect(path.at(-1)).toMatchObject({ x: 5, y: 1 })
  })

  it('turns a slide ninety degrees when it crosses a violet prism', () => {
    const { controller } = makeController()
    enterStageThree(controller)
    controller.elapsed = 1.3
    controller.player = { col: 1, row: 7, x: 1, y: 7, moving: false, shield: false }
    const path = controller.buildPath(1, 0)
    expect(path).toContainEqual(expect.objectContaining({ x: 7, y: 7, prism: 'cw' }))
    expect(path.at(-1)).toMatchObject({ x: 7, y: 11 })
  })

  it('uses a pulse gate as a timed wall and a live collision hazard', () => {
    const { controller } = makeController()
    enterStageThree(controller)
    controller.elapsed = 0
    controller.player = { col: 1, row: 7, x: 1, y: 7, moving: false, shield: false }
    expect(controller.buildPath(1, 0).at(-1)).toMatchObject({ x: 4, y: 7 })

    controller.elapsed = 1.3
    expect(controller.buildPath(1, 0).at(-1)).toMatchObject({ x: 7, y: 11 })

    controller.elapsed = 0
    controller.player = { col: 5, row: 7, x: 5, y: 7, moving: false, shield: false }
    controller.enemy = { x: 1.4, y: 7, direction: 1 }
    controller.update(.001)
    expect(controller.dying).toBeGreaterThan(0)
  })

  it('keeps the vault locked until both switches and every signal are cleared', () => {
    const { controller } = makeController()
    controller.dots.clear()
    controller.visit({ x: 11, y: 1 })
    expect(controller.clearing).toBe(0)

    controller.visit({ x: 5, y: 3 })
    controller.visit({ x: 11, y: 15 })
    expect(controller.switches.size).toBe(0)
    controller.visit({ x: 11, y: 1 })
    expect(controller.clearing).toBeGreaterThan(0)
  })

  it('opens solvable mint and violet stages and only finishes at the third exit', () => {
    const { controller, onFinish } = makeController()
    enterStageTwo(controller)

    expect(controller.player).toMatchObject({ col: 11, row: 17, moving: false })
    expect(controller.getStatus()).toBe('playing')
    expect(onFinish).not.toHaveBeenCalled()
    const analysis = analyzeVaultReachability(2)
    expect(analysis.stops.has('1,1')).toBe(true)
    expect([...controller.dots].every((key) => analysis.cells.has(key))).toBe(true)
    expect([...controller.switches].every((key) => analysis.cells.has(key))).toBe(true)
    expect([...analysis.stops].every((key) => analysis.returnableStops.has(key) && analysis.exitReachableStops.has(key))).toBe(true)

    controller.dots.clear()
    controller.switches.clear()
    controller.visit({ x: 1, y: 1 })
    for (let i = 0; i < 24; i++) controller.update(.033)
    expect(controller.stage).toBe(3)
    expect(controller.getStatus()).toBe('playing')
    expect(onFinish).not.toHaveBeenCalled()

    const violetAnalysis = analyzeVaultReachability(3)
    expect(violetAnalysis.stops.has('11,1')).toBe(true)
    expect([...controller.dots].every((key) => violetAnalysis.cells.has(key))).toBe(true)
    expect([...controller.switches].filter((key) => !violetAnalysis.cells.has(key))).toEqual([])
    expect([...violetAnalysis.stops].every((key) => violetAnalysis.returnableStops.has(key) && violetAnalysis.exitReachableStops.has(key))).toBe(true)

    controller.dots.clear()
    controller.switches.clear()
    controller.visit({ x: 11, y: 1 })
    for (let i = 0; i < 24; i++) controller.update(.033)
    expect(controller.getStatus()).toBe('finished')
    expect(onFinish).toHaveBeenCalledOnce()
  })
})
